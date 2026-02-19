import githubClient from './client.js';
import { getGithubUsername, getLastDays, getDateSinceDaysAgo, getContent, getVarFilter, filterByVars } from '../utils/parse-args.js';
import { config } from '../config.js';

async function fetchCommitDiff(repo, sha) {
  try {
    const { data } = await githubClient.get(`/repos/${repo}/commits/${sha}`, {
      headers: { Accept: 'application/vnd.github.diff' },
      responseType: 'text',
    });
    return data;
  } catch {
    return null;
  }
}

export async function getUserCommits(options = {}) {
  const { perPage = 30, sort = 'author-date', order = 'desc', lastDays, includeContent } = options;
  const username = options.username ?? getGithubUsername() ?? config.github.username;

  let targetUser = username;
  if (!targetUser) {
    const { data } = await githubClient.get('/user');
    targetUser = data.login;
  }

  const days = lastDays ?? getLastDays();
  const dateQualifier = days ? ` author-date:>${getDateSinceDaysAgo(days)}` : '';

  const { data } = await githubClient.get('/search/commits', {
    params: {
      q: `author:${targetUser}${dateQualifier}`.trim(),
      per_page: perPage,
      sort,
      order,
    },
  });

  const items = data.items || [];
  const result = [];

  for (const item of items) {
    const commit = {
      sha: item.sha,
      message: item.commit?.message,
      url: item.html_url,
      repository: item.repository?.full_name,
      author: item.commit?.author?.name,
      date: item.commit?.author?.date,
    };
    if (includeContent && item.repository?.full_name) {
      commit.content = await fetchCommitDiff(item.repository.full_name, item.sha);
    }
    result.push(commit);
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const perPage = parseInt(args.find((a) => a.startsWith('--per-page='))?.split('=')[1] || '30', 10);
  const username = getGithubUsername();
  const lastDays = getLastDays();

  const includeContent = getContent();
  const varFilter = getVarFilter();
  const commits = await getUserCommits({
    perPage,
    username: username ?? undefined,
    lastDays: lastDays ?? undefined,
    includeContent,
  });
  const output = varFilter ? filterByVars(commits, varFilter) : commits;
  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1]?.includes('github/user-commits')) {
  main().catch((err) => {
    if (err.response?.status === 401) {
      console.error('Autenticação GitHub falhou. Verifique GITHUB_TOKEN no .env');
    } else {
      console.error(err.response?.data?.message || err.message);
    }
    process.exit(1);
  });
}
