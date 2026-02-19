import gitlabClient from './client.js';
import { getGitlabUsername, getLastDays, getDateSinceDaysAgo, getContent, getVarFilter, filterByVars } from '../utils/parse-args.js';
import { config } from '../config.js';

async function fetchMrChanges(projectId, iid) {
  try {
    const { data } = await gitlabClient.get(
      `/projects/${encodeURIComponent(projectId)}/merge_requests/${iid}/changes`
    );
    return data.changes?.map((c) => ({
      oldPath: c.old_path,
      newPath: c.new_path,
      newFile: c.new_file,
      deletedFile: c.deleted_file,
      diff: c.diff,
    })) ?? null;
  } catch {
    return null;
  }
}

export async function getUserMerges(options = {}) {
  const { perPage = 30, state = 'all', lastDays, includeContent } = options;
  const username = options.username ?? getGitlabUsername() ?? config.gitlab.username;

  const days = lastDays ?? getLastDays();

  const params = {
    per_page: perPage,
    order_by: 'updated_at',
    sort: 'desc',
    state: state === 'all' ? undefined : state === 'open' ? 'opened' : state,
  };
  if (days) params.updated_after = new Date(getDateSinceDaysAgo(days)).toISOString();

  if (username) {
    params.author_username = username;
    params.scope = 'all';
  } else {
    params.scope = 'created_by_me';
  }

  const { data } = await gitlabClient.get('/merge_requests', { params });

  const mrs = Array.isArray(data) ? data : [];
  const result = [];

  for (const mr of mrs) {
    const projectId = mr.project_id ?? mr.source_project_id;
    const merge = {
      title: mr.title,
      url: mr.web_url,
      state: mr.state,
      merged: !!mr.merged_at,
      mergedAt: mr.merged_at,
      project: mr.references?.full ?? mr.source_branch,
      projectId,
      sourceBranch: mr.source_branch,
      targetBranch: mr.target_branch,
      createdAt: mr.created_at,
      updatedAt: mr.updated_at,
      iid: mr.iid,
    };
    if (includeContent && projectId && mr.iid) {
      merge.content = await fetchMrChanges(projectId, mr.iid);
    }
    result.push(merge);
  }

  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const state = args.find((a) => a.startsWith('--state='))?.split('=')[1] || 'all';
  const perPage = parseInt(args.find((a) => a.startsWith('--per-page='))?.split('=')[1] || '30', 10);
  const username = getGitlabUsername();

  const lastDays = getLastDays();
  const includeContent = getContent();
  const varFilter = getVarFilter();
  const merges = await getUserMerges({
    state,
    perPage,
    username: username ?? undefined,
    lastDays: lastDays ?? undefined,
    includeContent,
  });
  const output = varFilter ? filterByVars(merges, varFilter) : merges;
  console.log(JSON.stringify(output, null, 2));
}

if (process.argv[1]?.includes('gitlab/user-merges')) {
  main().catch((err) => {
    if (err.response?.status === 401) {
      console.error('Autenticação GitLab falhou. Verifique GITLAB_TOKEN no .env');
    } else {
      console.error(err.response?.data?.message || err.message);
    }
    process.exit(1);
  });
}
