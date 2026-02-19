import axios from 'axios';
import { config } from '../config.js';

const githubClient = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${config.github.token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  },
});

export default githubClient;
