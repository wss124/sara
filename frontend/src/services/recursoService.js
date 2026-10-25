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

export async function alterarEstadoRecurso(id, estado) {
  const response = await api.patch(`/recursos/${id}/estado`, { estado });
  return response.data;
}

export async function enviarFotoRecurso(id, arquivo) {
  const dados = new FormData();
  dados.append('foto', arquivo);
  const response = await api.put(`/recursos/${id}/foto`, dados);
  return response.data;
}

export async function removerFotoRecurso(id) {
  const response = await api.delete(`/recursos/${id}/foto`);
  return response.data;
}

// O backend devolve um caminho relativo (/uploads/...); monta a URL completa
export function urlFotoRecurso(foto) {
  return foto ? `${api.defaults.baseURL}${foto}` : null;
}

// Situação de cada turno do recurso, dia a dia, a partir de `inicio` (AAAA-MM-DD)
export async function consultarDisponibilidade(id, inicio, dias = 7) {
  const response = await api.get(`/recursos/${id}/disponibilidade`, { params: { inicio, dias } });
  return response.data;
}
