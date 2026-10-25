import api from './api';

// Séries semanais de reservas

export async function previaSerie(dados) {
  const response = await api.post('/recorrencias/previa', dados);
  return response.data.datas;
}

export async function criarSerie(dados) {
  const response = await api.post('/recorrencias', dados);
  return response.data;
}

export async function cancelarSerie(id) {
  const response = await api.delete(`/recorrencias/${id}`);
  return response.data;
}

// Administrador
export async function aprovarSerie(id) {
  const response = await api.patch(`/recorrencias/${id}/aprovar`);
  return response.data;
}

export async function recusarSerie(id, motivo) {
  const response = await api.patch(`/recorrencias/${id}/recusar`, { motivo });
  return response.data;
}
