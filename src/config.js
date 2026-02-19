import dotenv from 'dotenv';

dotenv.config();

function getEnv(key, required = false) {
  const value = process.env[key];
  if (required && !value) {
    throw new Error(`Variável de ambiente obrigatória não configurada: ${key}`);
  }
  return value || '';
}

export const config = {
  jira: {
    get baseUrl() {
      return getEnv('JIRA_BASE_URL', true).replace(/\/$/, '');
    },
    get email() {
      return getEnv('JIRA_EMAIL', true);
    },
    get apiToken() {
      return getEnv('JIRA_API_TOKEN', true);
    },
    get userEmail() {
      return getEnv('JIRA_USER_EMAIL') || getEnv('JIRA_EMAIL');
    },
  },
  github: {
    get token() {
      return getEnv('GITHUB_TOKEN', true);
    },
    get username() {
      return getEnv('GITHUB_USERNAME');
    },
  },
  gitlab: {
    get baseUrl() {
      return (getEnv('GITLAB_URL') || 'https://gitlab.com').replace(/\/$/, '');
    },
    get token() {
      return getEnv('GITLAB_TOKEN', true);
    },
    get username() {
      return getEnv('GITLAB_USERNAME');
    },
  },
};
