import githubClient from './client.js';
import { getGithubUsername, getLastDays, getDateSinceDaysAgo, getVarFilter, filterByVars } from '../utils/parse-args.js';
import { config } from '../config.js';

export async function getUserActivity(options = {}) {
  const { perPage = 30, lastDays } = options;
  const username = options.username ?? getGithubUsername() ?? config.github.username;

  let targetUser = username;
  if (!targetUser) {
    const { data } = await githubClient.get('/user');
    targetUser = data.login;
  }

  const { data } = await githubClient.get(`/users/${targetUser}/events`, {
    params: { per_page: Math.min(perPage * 2, 100) },
  });

  const days = lastDays ?? getLastDays();
  const cutoff = days ? new Date(getDateSinceDaysAgo(days)).getTime() : 0;
  let events = (data || []).map((event) => ({
    type: event.type,
    action: event.payload?.action,
    repo: event.repo?.name,
    createdAt: event.created_at,
    payload: {
      ref: event.payload?.ref,
      refType: event.payload?.ref_type,
      description: event.payload?.description,
      pushSize: event.payload?.size,
    },
  }));
  if (cutoff) events = events.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
  return events.slice(0, perPage);
}

async function main() {
  const args = process.argv.slice(2);
  const perPage = parseInt(args.find((a) => a.startsWith('--per-page='))?.split('=')[1] || '30', 10);
  const username = getGithubUsername();

  const lastDays = getLastDays();
  const varFilter = getVarFilter();
  const activity = await getUserActivity({ perPage, username: username ?? undefined, lastDays: lastDays ?? undefined });
  const output = varFilter ? filterByVars(activity, varFilter) : activity;
  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1]?.includes('github/user-activity')) {
  main().catch((err) => {
    if (err.response?.status === 401) {
      console.error('Autenticação GitHub falhou. Verifique GITHUB_TOKEN no .env');
    } else {
      console.error(err.response?.data?.message || err.message);
    }
    process.exit(1);
  });
}
