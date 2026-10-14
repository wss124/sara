import api from './api';

export async function listarAcessorios() {
  const response = await api.get('/acessorios');
  return response.data;
}

export async function criarAcessorio(dados) {
  const response = await api.post('/acessorios', dados);
  return response.data;
}

export async function atualizarAcessorio(id, dados) {
  const response = await api.put(`/acessorios/${id}`, dados);
  return response.data;
}

export async function regularizarAcessorio(id) {
  const response = await api.patch(`/acessorios/${id}/regularizar`);
  return response.data;
}

export async function removerAcessorio(id) {
  await api.delete(`/acessorios/${id}`);
}

// Kit do recurso com as unidades livres de cada item no período
export async function consultarDisponibilidadeAcessorios(recursoId, inicio, fim) {
  const response = await api.get('/acessorios/disponibilidade', {
    params: { recursoId, inicio, fim },
  });
  return response.data;
}

// itens: [{ acessorioId, obrigatorio }]
export async function definirKitRecurso(recursoId, itens) {
  const response = await api.put(`/recursos/${recursoId}/acessorios`, { itens });
  return response.data;
}
