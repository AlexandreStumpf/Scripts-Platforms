#!/usr/bin/env node

import { getJiraUserEmail, getGithubUsername, getGitlabUsername, getLastDays, getContent, getWorklogs, getVarFilter, filterByVars } from './utils/parse-args.js';

const runAll = process.argv.includes('--all');
const jiraUser = getJiraUserEmail();
const githubUser = getGithubUsername();
const gitlabUser = getGitlabUsername();
const lastDays = getLastDays();
const includeContent = getContent();
const includeWorklogs = getWorklogs();
const varFilter = getVarFilter();

async function main() {
  const results = { jira: null, github: null, gitlab: null };

  if (runAll) {
    console.log('Buscando informações do Jira, GitHub e GitLab...\n');
  }

  try {
    const { getUserInfo: getJiraUser } = await import('./jira/user-info.js');
    const { getUserIssues: getJiraIssues } = await import('./jira/user-issues.js');
    const jiraOpts = {
      ...(jiraUser && { userEmail: jiraUser }),
      ...(lastDays && { lastDays }),
      ...(includeContent && { includeContent }),
      ...(includeWorklogs && { includeWorklogs }),
    };
    const jiraData = await getJiraIssues({ maxResults: 10, ...jiraOpts });
    results.jira = {
      user: await getJiraUser(jiraOpts),
      issues: jiraData.issues,
      ...(jiraData.totalTimeWorkedSeconds != null && { totalTimeWorkedSeconds: jiraData.totalTimeWorkedSeconds }),
    };
    if (runAll) console.log('✓ Jira: dados obtidos');
  } catch (err) {
    results.jira = { error: err.message };
    if (runAll) console.log('✗ Jira:', err.message);
  }

  try {
    const { getUserInfo: getGithubUser } = await import('./github/user-info.js');
    const { getUserIssues: getGithubIssues } = await import('./github/user-issues.js');
    const githubOpts = { ...(githubUser && { username: githubUser }), ...(lastDays && { lastDays }), ...(includeContent && { includeContent }) };
    const { getUserCommits: getGithubCommits } = await import('./github/user-commits.js');
    const { getUserMerges: getGithubMerges } = await import('./github/user-merges.js');
    results.github = {
      user: await getGithubUser(githubOpts),
      issues: await getGithubIssues({ perPage: 10, ...githubOpts }),
      commits: await getGithubCommits({ perPage: 5, ...githubOpts }),
      merges: await getGithubMerges({ perPage: 5, ...githubOpts }),
    };
    if (runAll) console.log('✓ GitHub: dados obtidos');
  } catch (err) {
    results.github = { error: err.message };
    if (runAll) console.log('✗ GitHub:', err.message);
  }

  try {
    const { getUserInfo: getGitlabUser } = await import('./gitlab/user-info.js');
    const { getUserIssues: getGitlabIssues } = await import('./gitlab/user-issues.js');
    const gitlabOpts = { ...(gitlabUser && { username: gitlabUser }), ...(lastDays && { lastDays }), ...(includeContent && { includeContent }) };
    const { getUserCommits: getGitlabCommits } = await import('./gitlab/user-commits.js');
    const { getUserMerges: getGitlabMerges } = await import('./gitlab/user-merges.js');
    results.gitlab = {
      user: await getGitlabUser(gitlabOpts),
      issues: await getGitlabIssues({ perPage: 10, ...gitlabOpts }),
      commits: await getGitlabCommits({ perPage: 5, ...gitlabOpts }),
      merges: await getGitlabMerges({ perPage: 5, ...gitlabOpts }),
    };
    if (runAll) console.log('✓ GitLab: dados obtidos');
  } catch (err) {
    results.gitlab = { error: err.message };
    if (runAll) console.log('✗ GitLab:', err.message);
  }

  const output = varFilter ? filterByVars(results, varFilter) : results;
  console.log('\n' + JSON.stringify(output, null, 2));
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
