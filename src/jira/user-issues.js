import jiraClient from './client.js';
import { config } from '../config.js';
import { getJiraUserEmail, getLastDays, getContent, getWorklogs, getVarFilter, filterByVars } from '../utils/parse-args.js';
import { getUserInfo } from './user-info.js';
import { getUserWorklogs, formatSeconds } from './user-worklogs.js';

/**
 * Extracts plain text from ADF (Atlassian Document Format) nodes.
 * Aggregates text from paragraph and text nodes into a single string.
 */
function extractAdfText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;

  switch (node.type) {
    case 'text':
      return node.text ?? '';
    case 'hardBreak':
      return '\n';
    case 'paragraph':
    case 'heading':
    case 'listItem':
    case 'tableCell':
    case 'blockquote':
    case 'codeBlock': {
      const parts = (node.content ?? []).map(extractAdfText);
      return parts.join('');
    }
    case 'doc':
    case 'bulletList':
    case 'orderedList':
    case 'panel':
    case 'table':
    case 'tableRow':
    case 'tableHeader': {
      const parts = (node.content ?? []).map(extractAdfText);
      return parts.filter(Boolean).join('\n');
    }
    case 'mention':
      return node.attrs?.text ?? '';
    case 'emoji':
      return node.attrs?.shortName ?? '';
    case 'date':
      return node.attrs?.timestamp ?? '';
    default:
      if (Array.isArray(node.content)) {
        return node.content.map(extractAdfText).join('');
      }
      return '';
  }
}

function isAdfDoc(obj) {
  return obj && typeof obj === 'object' && obj.type === 'doc' && Array.isArray(obj.content);
}

function isAdfBodyNode(obj) {
  return (
    obj &&
    typeof obj === 'object' &&
    (obj.type === 'doc' || obj.type === 'paragraph') &&
    Array.isArray(obj.content)
  );
}

function addAdfTextToContent(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (isAdfDoc(obj)) {
    obj.text_group = extractAdfText(obj);
  }
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) v.forEach(addAdfTextToContent);
    else if (v && typeof v === 'object') addAdfTextToContent(v);
  }
}

/** Replaces body (type doc or paragraph) with { type, text_group: "..." } for a single message block. */
function flattenAdfBody(obj) {
  if (!obj || typeof obj !== 'object') return;
  if (obj.body && isAdfBodyNode(obj.body)) {
    const bodyType = obj.body.type;
    obj.body = { type: bodyType, text_group: extractAdfText(obj.body) };
  }
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) v.forEach(flattenAdfBody);
    else if (v && typeof v === 'object') flattenAdfBody(v);
  }
}

function stripAttachments(obj) {
  if (!obj) return obj;
  const cleaned = JSON.parse(JSON.stringify(obj));
  const removeAttachments = (o) => {
    if (!o || typeof o !== 'object') return;
    delete o.attachment;
    delete o.attachments;
    Object.values(o).forEach((v) => {
      if (Array.isArray(v)) v.forEach(removeAttachments);
      else if (v && typeof v === 'object') removeAttachments(v);
    });
  };
  removeAttachments(cleaned);
  return cleaned;
}

async function fetchIssueFull(key, includeContent) {
  if (!includeContent) return null;
  try {
    const { data } = await jiraClient.get(`/issue/${key}`, {
      params: { expand: 'renderedFields,changelog' },
    });
    const cleaned = stripAttachments(data);
    addAdfTextToContent(cleaned);
    const { data: commentsData } = await jiraClient.get(`/issue/${key}/comment`);
    if (commentsData?.comments?.length) {
      cleaned.comments = commentsData.comments.map((c) => {
        const stripped = stripAttachments(c);
        addAdfTextToContent(stripped);
        flattenAdfBody(stripped);
        return stripped;
      });
    }
    return cleaned;
  } catch {
    return null;
  }
}

export async function getUserIssues(options = {}) {
  const { maxResults = 50, jql = '', lastDays, includeContent, includeWorklogs } = options;
  const userEmail = options.userEmail ?? getJiraUserEmail() ?? config.jira.userEmail;
  const isCurrentUser = userEmail === config.jira.email;

  const days = lastDays ?? getLastDays();
  const dateClause = days ? ` AND updated >= -${days}d` : '';

  const assigneeClause = isCurrentUser ? 'assignee = currentUser()' : `assignee = "${userEmail}"`;
  const baseJql = `${assigneeClause}${dateClause} ORDER BY updated DESC`;
  const fullJql = jql ? `${baseJql} AND ${jql}` : baseJql;

  const { data } = await jiraClient.post('/search/jql', {
    jql: fullJql,
    maxResults,
    fields: ['summary', 'status', 'priority', 'created', 'updated', 'issuetype'],
  });

  const issues = data.issues ?? [];
  const result = [];

  for (const issue of issues) {
    const base = {
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status?.name,
      priority: issue.fields.priority?.name,
      type: issue.fields.issuetype?.name,
      created: issue.fields.created,
      updated: issue.fields.updated,
    };
    if (includeContent) {
      base.content = await fetchIssueFull(issue.key, true);
    }
    result.push(base);
  }

  let totalTimeWorkedSeconds;
  if (includeWorklogs && result.length > 0 && days) {
    try {
      const userInfo = await getUserInfo({ userEmail: userEmail ?? undefined });
      const accountId = userInfo?.accountId;
      if (accountId) {
        const { timeByIssue, totalTimeWorkedSeconds: total } = await getUserWorklogs(result, accountId, days);
        totalTimeWorkedSeconds = total;
        for (const issue of result) {
          const seconds = timeByIssue.get(issue.key) ?? 0;
          issue.timeWorkedSeconds = seconds;
          issue.timeWorkedFormatted = formatSeconds(seconds);
        }
      }
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 404) {
        for (const issue of result) {
          issue.timeWorkedSeconds = 0;
          issue.timeWorkedFormatted = '0m';
        }
        totalTimeWorkedSeconds = 0;
      } else {
        throw err;
      }
    }
  }

  return { issues: result, totalTimeWorkedSeconds };
}

async function main() {
  const args = process.argv.slice(2);
  const maxResults = parseInt(args.find((a) => a.startsWith('--max='))?.split('=')[1] || '50', 10);
  const userEmail = getJiraUserEmail();
  const lastDays = getLastDays();

  const includeContent = getContent();
  const includeWorklogs = getWorklogs();
  const varFilter = getVarFilter();
  const result = await getUserIssues({
    maxResults,
    userEmail: userEmail ?? undefined,
    lastDays: lastDays ?? undefined,
    includeContent,
    includeWorklogs,
  });
  const output = varFilter ? filterByVars(result, varFilter) : result;
  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1]?.includes('jira/user-issues')) {
  main().catch((err) => {
    console.error(err.response?.data?.errorMessages?.join('\n') || err.message);
    process.exit(1);
  });
}
