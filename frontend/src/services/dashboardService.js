import api from './api';

export async function carregarDashboard() {
  const response = await api.get('/dashboard');
  return response.data;
}

// Abre o canal de avisos em tempo real (Server-Sent Events). aoMudar é
// chamado a cada alteração no sistema; aoMudarConexao recebe true/false
// conforme a conexão está aberta. Devolve a função que fecha o canal.
export function ouvirAtualizacoes(aoMudar, aoMudarConexao) {
  const token = localStorage.getItem('sara_token');
  const url = `${api.defaults.baseURL}/dashboard/eventos?token=${encodeURIComponent(token ?? '')}`;
  const fonte = new EventSource(url);

  fonte.addEventListener('atualizacao', aoMudar);
  // O navegador reconecta sozinho depois de uma queda
  fonte.onopen = () => aoMudarConexao(true);
  fonte.onerror = () => aoMudarConexao(false);

  return () => fonte.close();
}
