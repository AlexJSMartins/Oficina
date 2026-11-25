import axios from 'axios';

export const SYS_TOKEN_KEY = '@oficina:sys_token';

export const sysApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

sysApi.interceptors.request.use((config) => {
  const token = localStorage.getItem(SYS_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});