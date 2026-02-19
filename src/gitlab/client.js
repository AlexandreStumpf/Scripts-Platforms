import axios from 'axios';
import { config } from '../config.js';

const gitlabClient = axios.create({
  baseURL: `${config.gitlab.baseUrl}/api/v4`,
  headers: {
    'PRIVATE-TOKEN': config.gitlab.token,
    'Content-Type': 'application/json',
  },
});

export default gitlabClient;
