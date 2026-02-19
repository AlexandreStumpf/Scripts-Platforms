import githubClient from './client.js';
import { getGithubUsername, getLastDays, getDateSinceDaysAgo, getContent, getVarFilter, filterByVars } from '../utils/parse-args.js';
import { config } from '../config.js';

function getRepoFromUrl(repositoryUrl) {
  const match = repositoryUrl?.match(/\/repos\/([^/]+\/[^/]+)/);
  return match ? match[1] : null;
}

async function fetchPrFiles(repo, pullNumber) {
  try {
    const { data } = await githubClient.get(`/repos/${repo}/pulls/${pullNumber}/files`);
    return (data || []).map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
    }));
  } catch {
    return null;
  }
}

export async function getUserMerges(options = {}) {
  const { perPage = 30, state = 'all', lastDays, includeContent } = options;
  const username = options.username ?? getGithubUsername() ?? config.github.username;

  let targetUser = username;
  if (!targetUser) {
    const { data } = await githubClient.get('/user');
    targetUser = data.login;
  }

  const days = lastDays ?? getLastDays();
  const dateQualifier = days ? ` updated:>${getDateSinceDaysAgo(days)}` : '';
  const stateQualifier = state === 'open' ? 'is:open' : state === 'closed' ? 'is:closed' : '';
  const q = `author:${targetUser} is:pr ${stateQualifier}${dateQualifier}`.trim();

  const { data } = await githubClient.get('/search/issues', {
    params: {
      q,
      sort: 'updated',
      order: 'desc',
      per_page: perPage,
    },
  });

  const items = data.items || [];
  const result = [];

  for (const item of items) {
    const repo = getRepoFromUrl(item.repository_url) || item.repository?.full_name;
    const merge = {
      title: item.title,
      url: item.html_url,
      state: item.state,
      merged: !!item.pull_request?.merged_at,
      mergedAt: item.pull_request?.merged_at,
      repository: repo,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };
    if (includeContent && repo && item.number) {
      merge.content = await fetchPrFiles(repo, item.number);
    }
    result.push(merge);
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const state = args.find((a) => a.startsWith('--state='))?.split('=')[1] || 'all';
  const perPage = parseInt(args.find((a) => a.startsWith('--per-page='))?.split('=')[1] || '30', 10);
  const username = getGithubUsername();

  const lastDays = getLastDays();
  const includeContent = getContent();
  const varFilter = getVarFilter();
  const merges = await getUserMerges({
    state,
    perPage,
    username: username ?? undefined,
    lastDays: lastDays ?? undefined,
    includeContent,
  });
  const output = varFilter ? filterByVars(merges, varFilter) : merges;
  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1]?.includes('github/user-merges')) {
  main().catch((err) => {
    if (err.response?.status === 401) {
      console.error('Autenticação GitHub falhou. Verifique GITHUB_TOKEN no .env');
    } else {
      console.error(err.response?.data?.message || err.message);
    }
    process.exit(1);
  });
}
