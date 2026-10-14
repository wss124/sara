import api from './api';

export async function criarSolicitacao(dados) {
  const response = await api.post('/solicitacoes', dados);
  return response.data;
}

export async function listarMinhasSolicitacoes() {
  const response = await api.get('/solicitacoes/minhas');
  return response.data;
}

export async function cancelarSolicitacao(id) {
  await api.delete(`/solicitacoes/${id}`);
}

export async function consultarOcupacao(recursoId, inicio, fim) {
  const response = await api.get('/solicitacoes/ocupacao', {
    params: { recursoId, inicio, fim },
  });
  return response.data;
}

// Administrador
export async function listarSolicitacoes(status) {
  const response = await api.get('/solicitacoes', { params: status ? { status } : {} });
  return response.data;
}

export async function aprovarSolicitacao(id) {
  const response = await api.patch(`/solicitacoes/${id}/aprovar`);
  return response.data;
}

export async function recusarSolicitacao(id) {
  const response = await api.patch(`/solicitacoes/${id}/recusar`);
  return response.data;
}

export async function lancarReserva(dados) {
  const response = await api.post('/solicitacoes/reservas', dados);
  return response.data;
}

export async function carregarMovimentacoes() {
  const response = await api.get('/solicitacoes/movimentacoes');
  return response.data;
}

export async function registrarRetirada(id) {
  const response = await api.patch(`/solicitacoes/${id}/retirada`);
  return response.data;
}

export async function registrarDevolucao(id, dados = {}) {
  const response = await api.patch(`/solicitacoes/${id}/devolucao`, dados);
  return response.data;
}

export async function cancelarPeloAdmin(id, motivo) {
  const response = await api.patch(`/solicitacoes/${id}/cancelamento`, { motivo });
  return response.data;
}

export async function cancelarReserva(id) {
  await api.delete(`/solicitacoes/reservas/${id}`);
}
