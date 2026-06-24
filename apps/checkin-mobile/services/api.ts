import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://YOUR_IP:3000/api/v1',
});