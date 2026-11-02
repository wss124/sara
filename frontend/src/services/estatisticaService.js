import api from './api';

// Estatísticas de uso no período (datas "AAAA-MM-DD", inclusivas). Só admin.
export async function carregarEstatisticas(inicio, fim) {
  const response = await api.get('/estatisticas', { params: { inicio, fim } });
  return response.data;
}
