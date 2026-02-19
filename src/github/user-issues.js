import githubClient from './client.js';
import { getGithubUsername, getLastDays, getDateSinceDaysAgo, getVarFilter, filterByVars } from '../utils/parse-args.js';

export async function getUserIssues(options = {}) {
  const { state = 'all', perPage = 30, lastDays } = options;
  const username = options.username ?? getGithubUsername();

  const days = lastDays ?? getLastDays();
  const dateQualifier = days ? ` updated:>${getDateSinceDaysAgo(days)}` : '';

  if (username) {
    const { data } = await githubClient.get('/search/issues', {
      params: {
        q: `assignee:${username} is:issue${dateQualifier}`.trim(),
        sort: 'updated',
        order: 'desc',
        per_page: perPage,
      },
    });
    return (data.items || []).map((issue) => ({
      title: issue.title,
      url: issue.html_url,
      state: issue.state,
      repository: issue.repository_url?.replace(/.+\/repos\//, ''),
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
      isPullRequest: !!issue.pull_request,
    }));
  }

  const params = { state, per_page: perPage, filter: 'assigned' };
  if (days) params.since = new Date(getDateSinceDaysAgo(days)).toISOString();
  const { data } = await githubClient.get('/issues', { params });

  return data.map((issue) => ({
    title: issue.title,
    url: issue.html_url,
    state: issue.state,
    repository: issue.repository?.full_name,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    isPullRequest: !!issue.pull_request,
  }));
}

async function main() {
  const args = process.argv.slice(2);
  const state = args.find((a) => a.startsWith('--state='))?.split('=')[1] || 'all';
  const perPage = parseInt(args.find((a) => a.startsWith('--per-page='))?.split('=')[1] || '30', 10);
  const username = getGithubUsername();

  const lastDays = getLastDays();
  const varFilter = getVarFilter();
  const issues = await getUserIssues({ state, perPage, username: username ?? undefined, lastDays: lastDays ?? undefined });
  const output = varFilter ? filterByVars(issues, varFilter) : issues;
  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1]?.includes('github/user-issues')) {
  main().catch((err) => {
    if (err.response?.status === 401) {
      console.error('Autenticação GitHub falhou. Verifique GITHUB_TOKEN no .env');
    } else {
      console.error(err.response?.data?.message || err.message);
    }
    process.exit(1);
  });
}
