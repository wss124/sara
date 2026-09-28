import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3333',
});

// Envia o token JWT em todas as requisições
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sara_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Token expirado ou inválido: limpa a sessão e volta para o login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLogin = error.config?.url?.startsWith('/auth/');
    if (error.response?.status === 401 && !isLogin) {
      localStorage.removeItem('sara_auth');
      localStorage.removeItem('sara_token');
      localStorage.removeItem('sara_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
