import api from './api';

export async function listarUsuarios(perfil) {
  const response = await api.get('/usuarios', { params: perfil ? { perfil } : {} });
  return response.data;
}

export async function alterarPerfil(id, perfil) {
  const response = await api.patch(`/usuarios/${id}/perfil`, { perfil });
  return response.data;
}
