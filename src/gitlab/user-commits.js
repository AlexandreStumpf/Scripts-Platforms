import gitlabClient from './client.js';
import { getGitlabUsername, getLastDays, getDateSinceDaysAgo, getContent, getVarFilter, filterByVars } from '../utils/parse-args.js';
import { config } from '../config.js';

async function getUserId(username) {
  if (username) {
    const { data } = await gitlabClient.get('/users', { params: { username } });
    const user = Array.isArray(data) ? data[0] : data;
    if (!user) throw new Error(`Usuário não encontrado: ${username}`);
    return user.id;
  }
  const { data } = await gitlabClient.get('/user');
  return data.id;
}

/**
 * Retorna commits via eventos de push. GitLab não possui busca global de commits,
 * então usamos os eventos "pushed" do usuário.
 * Para commits detalhados de um projeto: use --project=ID
 */
async function fetchCommitDiff(projectId, sha) {
  try {
    const { data } = await gitlabClient.get(
      `/projects/${encodeURIComponent(projectId)}/repository/commits/${encodeURIComponent(sha)}/diff`
    );
    return Array.isArray(data) ? data : [];
  } catch {
    return null;
  }
}

export async function getUserCommits(options = {}) {
  const { perPage = 30, projectId, lastDays, includeContent } = options;
  const username = options.username ?? getGitlabUsername() ?? config.gitlab.username;
  const days = lastDays ?? getLastDays();
  const sinceDate = days ? getDateSinceDaysAgo(days) : null;

  if (projectId) {
    const params = { per_page: perPage, order_by: 'created_at', sort: 'desc' };
    if (username) params.author = username;
    if (sinceDate) params.since = sinceDate;
    const { data } = await gitlabClient.get(`/projects/${encodeURIComponent(projectId)}/repository/commits`, {
      params,
    });
    const commits = Array.isArray(data) ? data : [];
    const result = [];

    for (const c of commits) {
      const sha = c.id || c.short_id;
      const commit = {
        sha: c.short_id || c.id,
        message: c.title,
        url: c.web_url,
        author: c.author_name,
        date: c.committed_date || c.created_at,
      };
      if (includeContent && sha) {
        commit.content = await fetchCommitDiff(projectId, sha);
      }
      result.push(commit);
    }
    return result;
  }

  const userId = await getUserId(username);
  const params = { action: 'pushed', per_page: perPage, sort: 'desc' };
  if (sinceDate) params.after = sinceDate;
  const { data } = await gitlabClient.get(`/users/${userId}/events`, { params });

  const events = Array.isArray(data) ? data : [];
  const result = [];

  for (const event of events) {
    const pushData = event.push_data || {};
    const item = {
      type: 'push',
      projectId: event.project_id,
      ref: pushData.ref,
      refType: pushData.ref_type,
      commitCount: pushData.commit_count,
      createdAt: event.created_at,
      commitFrom: pushData.commit_from,
      commitTo: pushData.commit_to,
    };
    if (includeContent && event.project_id && pushData.commit_to) {
      item.content = await fetchCommitDiff(event.project_id, pushData.commit_to);
    }
    result.push(item);
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const perPage = parseInt(args.find((a) => a.startsWith('--per-page='))?.split('=')[1] || '30', 10);
  const projectId = args.find((a) => a.startsWith('--project='))?.split('=')[1];
  const username = getGitlabUsername();

  const lastDays = getLastDays();
  const includeContent = getContent();
  const varFilter = getVarFilter();
  const commits = await getUserCommits({
    perPage,
    projectId,
    username: username ?? undefined,
    lastDays: lastDays ?? undefined,
    includeContent,
  });
  const output = varFilter ? filterByVars(commits, varFilter) : commits;
  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1]?.includes('gitlab/user-commits')) {
  main().catch((err) => {
    if (err.response?.status === 401) {
      console.error('Autenticação GitLab falhou. Verifique GITLAB_TOKEN no .env');
    } else {
      console.error(err.response?.data?.message || err.message);
    }
    process.exit(1);
  });
}
