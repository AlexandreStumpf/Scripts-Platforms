import axios from 'axios';
import { config } from '../config.js';

const jiraClient = axios.create({
  baseURL: `${config.jira.baseUrl}/rest/api/3`,
  auth: {
    username: config.jira.email,
    password: config.jira.apiToken,
  },
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

export default jiraClient;
