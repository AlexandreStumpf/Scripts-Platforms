import githubClient from './client.js';
import { config } from '../config.js';
import { getGithubUsername, getVarFilter, filterByVars } from '../utils/parse-args.js';

export async function getUserInfo(options = {}) {
  const username = options.username ?? getGithubUsername() ?? config.github.username;

  if (username) {
    const { data } = await githubClient.get(`/users/${username}`);
    return {
      login: data.login,
      name: data.name,
      email: data.email,
      bio: data.bio,
      publicRepos: data.public_repos,
      followers: data.followers,
      following: data.following,
    };
  }

  const { data } = await githubClient.get('/user');
  return {
    login: data.login,
    name: data.name,
    email: data.email,
    bio: data.bio,
    publicRepos: data.public_repos,
    followers: data.followers,
    following: data.following,
  };
}

async function main() {
  const varFilter = getVarFilter();
  const user = await getUserInfo({});
  const output = varFilter ? filterByVars(user, varFilter) : user;
  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1]?.includes('github/user-info')) {
  main().catch((err) => {
    if (err.response?.status === 401) {
      console.error('Autenticação GitHub falhou. Verifique GITHUB_TOKEN no .env');
    } else {
      console.error(err.response?.data?.message || err.message);
    }
    process.exit(1);
  });
}
