import axios from 'axios';

export const getBackendUrl = () => {
  const url = (import.meta && import.meta.env && import.meta.env.REACT_APP_BACKEND_URL) || process.env.REACT_APP_BACKEND_URL;
  if (!url) return '';
  return url.endsWith('/') ? url.slice(0, -1) : url;
};

export const api = axios.create({ baseURL: getBackendUrl() + '/api' });

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};