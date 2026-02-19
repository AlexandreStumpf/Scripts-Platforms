import gitlabClient from './client.js';
import { config } from '../config.js';
import { getGitlabUsername, getVarFilter, filterByVars } from '../utils/parse-args.js';

export async function getUserInfo(options = {}) {
  const username = options.username ?? getGitlabUsername() ?? config.gitlab.username;

  if (username) {
    const { data } = await gitlabClient.get('/users', {
      params: { username },
    });
    const user = Array.isArray(data) ? data[0] : data;
    if (!user) throw new Error(`Usuário não encontrado: ${username}`);
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.public_email || user.email,
      state: user.state,
      webUrl: user.web_url,
      avatarUrl: user.avatar_url,
    };
  }

  const { data } = await gitlabClient.get('/user');
  return {
    id: data.id,
    username: data.username,
    name: data.name,
    email: data.public_email || data.email,
    state: data.state,
    webUrl: data.web_url,
    avatarUrl: data.avatar_url,
  };
}

async function main() {
  const varFilter = getVarFilter();
  const user = await getUserInfo({});
  const output = varFilter ? filterByVars(user, varFilter) : user;
  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1]?.includes('gitlab/user-info')) {
  main().catch((err) => {
    if (err.response?.status === 401) {
      console.error('Autenticação GitLab falhou. Verifique GITLAB_TOKEN no .env');
    } else {
      console.error(err.response?.data?.message || err.message);
    }
    process.exit(1);
  });
}
