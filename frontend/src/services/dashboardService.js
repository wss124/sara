import api from './api';

export async function carregarDashboard() {
  const response = await api.get('/dashboard');
  return response.data;
}
