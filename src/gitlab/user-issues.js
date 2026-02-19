import gitlabClient from './client.js';
import { getGitlabUsername, getLastDays, getDateSinceDaysAgo, getVarFilter, filterByVars } from '../utils/parse-args.js';

export async function getUserIssues(options = {}) {
  const { state = 'all', perPage = 30, lastDays } = options;
  const username = options.username ?? getGitlabUsername();

  const days = lastDays ?? getLastDays();

  const params = {
    per_page: perPage,
    order_by: 'updated_at',
    sort: 'desc',
    state: state === 'all' ? undefined : state === 'open' ? 'opened' : state,
  };
  if (days) params.updated_after = new Date(getDateSinceDaysAgo(days)).toISOString();

  if (username) {
    params.assignee_username = username;
  } else {
    params.scope = 'assigned_to_me';
  }

  const { data } = await gitlabClient.get('/issues', { params });

  return (Array.isArray(data) ? data : []).map((issue) => ({
    title: issue.title,
    url: issue.web_url,
    state: issue.state,
    project: issue.references?.full ?? issue.project_id,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    iid: issue.iid,
  }));
}

async function main() {
  const args = process.argv.slice(2);
  const state = args.find((a) => a.startsWith('--state='))?.split('=')[1] || 'all';
  const perPage = parseInt(args.find((a) => a.startsWith('--per-page='))?.split('=')[1] || '30', 10);
  const username = getGitlabUsername();

  const lastDays = getLastDays();
  const varFilter = getVarFilter();
  const issues = await getUserIssues({ state, perPage, username: username ?? undefined, lastDays: lastDays ?? undefined });
  const output = varFilter ? filterByVars(issues, varFilter) : issues;
  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1]?.includes('gitlab/user-issues')) {
  main().catch((err) => {
    if (err.response?.status === 401) {
      console.error('Autenticação GitLab falhou. Verifique GITLAB_TOKEN no .env');
    } else {
      console.error(err.response?.data?.message || err.message);
    }
    process.exit(1);
  });
}
