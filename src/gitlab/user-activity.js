import gitlabClient from './client.js';
import { getGitlabUsername, getLastDays, getDateSinceDaysAgo, getVarFilter, filterByVars } from '../utils/parse-args.js';
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

export async function getUserActivity(options = {}) {
  const { perPage = 30, action, lastDays } = options;
  const username = options.username ?? getGitlabUsername() ?? config.gitlab.username;

  const days = lastDays ?? getLastDays();

  const userId = await getUserId(username);
  const params = { per_page: perPage, sort: 'desc' };
  if (action) params.action = action;
  if (days) params.after = new Date(getDateSinceDaysAgo(days)).toISOString();

  const { data } = await gitlabClient.get(`/users/${userId}/events`, { params });

  return (Array.isArray(data) ? data : []).map((event) => ({
    action: event.action_name,
    targetType: event.target_type,
    projectId: event.project_id,
    createdAt: event.created_at,
    author: event.author?.username,
    targetTitle: event.target_title,
    pushData: event.push_data
      ? {
          ref: event.push_data.ref,
          commitCount: event.push_data.commit_count,
        }
      : undefined,
  }));
}

async function main() {
  const args = process.argv.slice(2);
  const perPage = parseInt(args.find((a) => a.startsWith('--per-page='))?.split('=')[1] || '30', 10);
  const action = args.find((a) => a.startsWith('--action='))?.split('=')[1];
  const username = getGitlabUsername();

  const lastDays = getLastDays();
  const varFilter = getVarFilter();
  const activity = await getUserActivity({ perPage, action, username: username ?? undefined, lastDays: lastDays ?? undefined });
  const output = varFilter ? filterByVars(activity, varFilter) : activity;
  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1]?.includes('gitlab/user-activity')) {
  main().catch((err) => {
    if (err.response?.status === 401) {
      console.error('Autenticação GitLab falhou. Verifique GITLAB_TOKEN no .env');
    } else {
      console.error(err.response?.data?.message || err.message);
    }
    process.exit(1);
  });
}
