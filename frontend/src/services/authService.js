import api from './api';

export async function loginRequest(email, senha) {
  const response = await api.post('/auth/login', { email, senha });
  return response.data;
}

export async function registerRequest(nome, email, senha) {
  const response = await api.post('/auth/register', { nome, email, senha });
  return response.data;
}