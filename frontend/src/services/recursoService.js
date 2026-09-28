import api from './api';

export async function listarRecursos(filtros = {}) {
  const response = await api.get('/recursos', { params: filtros });
  return response.data;
}

export async function criarRecurso(dados) {
  const response = await api.post('/recursos', dados);
  return response.data;
}

export async function atualizarRecurso(id, dados) {
  const response = await api.put(`/recursos/${id}`, dados);
  return response.data;
}

export async function removerRecurso(id) {
  await api.delete(`/recursos/${id}`);
}
