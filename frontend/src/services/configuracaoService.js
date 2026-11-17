import api from './api';

// Regras de antecedência dos pedidos (todos leem; só o admin altera)

export async function obterConfiguracao() {
  const response = await api.get('/configuracoes');
  return response.data;
}

export async function atualizarConfiguracao(dados) {
  const response = await api.put('/configuracoes', dados);
  return response.data;
}
