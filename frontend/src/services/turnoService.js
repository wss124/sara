import api from './api';

export async function listarTurnos() {
  const response = await api.get('/turnos');
  return response.data;
}

export async function criarTurno(dados) {
  const response = await api.post('/turnos', dados);
  return response.data;
}

export async function atualizarTurno(id, dados) {
  const response = await api.put(`/turnos/${id}`, dados);
  return response.data;
}

export async function removerTurno(id) {
  await api.delete(`/turnos/${id}`);
}
