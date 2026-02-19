/**
 * Extrai opções da linha de comando.
 * --user=X ou --jira-user=X ou --github-user=X ou --gitlab-user=X
 * --last-days=XX (filtra dados dos últimos XX dias)
 */
export function parseUserArg() {
  const args = process.argv.slice(2);
  const getArg = (prefix) => args.find((a) => a.startsWith(prefix))?.split('=')[1];
  return {
    user: getArg('--user='),
    jiraUser: getArg('--jira-user='),
    githubUser: getArg('--github-user='),
    gitlabUser: getArg('--gitlab-user='),
  };
}

export function getLastDays() {
  const args = process.argv.slice(2);
  const val = args.find((a) => a.startsWith('--last-days='))?.split('=')[1];
  const days = val ? parseInt(val, 10) : null;
  return Number.isNaN(days) || days <= 0 ? null : days;
}

export function getContent() {
  const args = process.argv.slice(2);
  return args.includes('--content');
}

export function getWorklogs() {
  const args = process.argv.slice(2);
  return args.includes('--worklogs');
}

/** Retorna array de variáveis de --var=var1,var2,var3 ou null se não especificado */
export function getVarFilter() {
  const args = process.argv.slice(2);
  const val = args.find((a) => a.startsWith('--var='))?.split('=')[1];
  if (!val?.trim()) return null;
  return val.split(',').map((v) => v.trim()).filter(Boolean);
}

/** Verifica se o valor contém alguma chave solicitada (diretamente ou aninhada) */
function hasRequestedContent(val, set) {
  if (val == null || typeof val !== 'object') return false;
  if (Array.isArray(val)) return val.some((v) => hasRequestedContent(v, set));
  for (const [k, v] of Object.entries(val)) {
    if (set.has(k)) return true;
    if (hasRequestedContent(v, set)) return true;
  }
  return false;
}

/** Filtra objeto/array mantendo chaves em vars ou que levam a elas (preserva caminhos aninhados) */
export function filterByVars(obj, vars) {
  if (vars == null || vars.length === 0) return obj;
  const set = new Set(vars);

  function filter(val) {
    if (val == null || typeof val !== 'object') return val;
    if (Array.isArray(val)) return val.map(filter).filter((v) => hasRequestedContent(v, set));
    const filtered = {};
    for (const [k, v] of Object.entries(val)) {
      const filteredV = filter(v);
      const keep = set.has(k) || hasRequestedContent(filteredV, set);
      if (keep) filtered[k] = filteredV;
    }
    return filtered;
  }

  return filter(obj);
}

/** Retorna data ISO (YYYY-MM-DD) de X dias atrás */
export function getDateSinceDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function getJiraUserEmail() {
  const { user, jiraUser } = parseUserArg();
  return jiraUser ?? user ?? null;
}

export function getGithubUsername() {
  const { user, githubUser } = parseUserArg();
  return githubUser ?? user ?? null;
}

export function getGitlabUsername() {
  const { user, gitlabUser } = parseUserArg();
  return gitlabUser ?? user ?? null;
}
