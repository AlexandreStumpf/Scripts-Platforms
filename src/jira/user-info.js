import jiraClient from './client.js';
import { config } from '../config.js';
import { getJiraUserEmail, getVarFilter, filterByVars } from '../utils/parse-args.js';

export async function getUserInfo(options = {}) {
  const userEmail = options.userEmail ?? getJiraUserEmail() ?? config.jira.userEmail;
  const isCurrentUser = userEmail === config.jira.email;

  try {
    if (isCurrentUser) {
      const { data } = await jiraClient.get('/myself');
      return {
        accountId: data.accountId,
        displayName: data.displayName,
        email: data.emailAddress,
        active: data.active,
        timeZone: data.timeZone,
      };
    }

    const { data } = await jiraClient.get('/user/search', {
      params: { query: userEmail },
    });
    const found = data.find((u) => u.emailAddress === userEmail) ?? data[0];
    if (!found) throw new Error(`Usuário não encontrado: ${userEmail}`);
    // Fallback: Jira omite emailAddress quando o usuário tem privacidade "Only you and admins"
    const email = found.emailAddress || (userEmail.includes('@') ? userEmail : null);
    return {
      accountId: found.accountId,
      displayName: found.displayName,
      email,
      active: found.active,
      timeZone: found.timeZone,
    };
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('Autenticação Jira falhou. Verifique JIRA_EMAIL e JIRA_API_TOKEN no .env');
    }
    throw error;
  }
}

async function main() {
  const userEmail = getJiraUserEmail();
  const varFilter = getVarFilter();
  const user = await getUserInfo(userEmail ? { userEmail } : {});
  const output = varFilter ? filterByVars(user, varFilter) : user;
  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1]?.includes('jira/user-info')) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
