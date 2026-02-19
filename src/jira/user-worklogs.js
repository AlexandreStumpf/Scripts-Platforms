import jiraClient from './client.js';

/**
 * Converte segundos em formato legível (ex: "2h 30m").
 */
export function formatSeconds(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (h) parts.push(`${h}h`);
  if (m || !h) parts.push(`${m}m`);
  return parts.join(' ');
}

/**
 * Busca worklogs de uma issue com paginação.
 * @param {string} issueKey - Chave da issue (ex: PROJ-123)
 * @param {object} options - { startedAfter (ms), startedBefore (ms) }
 * @returns {Promise<Array>} Lista de worklogs
 */
export async function fetchIssueWorklogs(issueKey, options = {}) {
  const params = { maxResults: 100 };
  if (options.startedAfter != null) params.startedAfter = options.startedAfter;
  if (options.startedBefore != null) params.startedBefore = options.startedBefore;

  const allWorklogs = [];
  let startAt = 0;

  while (true) {
    const { data } = await jiraClient.get(`/issue/${issueKey}/worklog`, {
      params: { ...params, startAt },
    });
    const worklogs = data.worklogs ?? [];
    allWorklogs.push(...worklogs);
    if (worklogs.length < (params.maxResults ?? 100)) break;
    startAt += worklogs.length;
    if (startAt >= (data.total ?? 0)) break;
  }

  return allWorklogs;
}

/**
 * Calcula o tempo trabalhado pelo usuário nas issues, filtrando por autor e período.
 * @param {Array} issues - Lista de issues { key, summary, ... }
 * @param {string} userAccountId - accountId do usuário (do getUserInfo)
 * @param {number} lastDays - Número de dias para filtrar (ex: 7)
 * @returns {Promise<{ timeByIssue: Map<string, number>, totalTimeWorkedSeconds: number }>}
 */
export async function getUserWorklogs(issues, userAccountId, lastDays) {
  if (!userAccountId || !issues?.length) {
    return { timeByIssue: new Map(), totalTimeWorkedSeconds: 0 };
  }

  const startedAfter = Date.now() - lastDays * 24 * 60 * 60 * 1000;
  const timeByIssue = new Map();

  for (const issue of issues) {
    try {
      const worklogs = await fetchIssueWorklogs(issue.key, { startedAfter });
      let seconds = 0;
      for (const w of worklogs) {
        const authorId = w.author?.accountId;
        if (authorId !== userAccountId) continue;
        const started = new Date(w.started).getTime();
        if (started < startedAfter) continue;
        seconds += w.timeSpentSeconds ?? 0;
      }
      timeByIssue.set(issue.key, seconds);
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 404) {
        timeByIssue.set(issue.key, 0);
      } else {
        throw err;
      }
    }
  }

  const totalTimeWorkedSeconds = [...timeByIssue.values()].reduce((a, b) => a + b, 0);
  return { timeByIssue, totalTimeWorkedSeconds };
}
