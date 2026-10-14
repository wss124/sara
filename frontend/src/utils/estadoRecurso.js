// Estados operacionais do recurso (enum EstadoRecurso do backend)
export const ESTADOS_RECURSO = {
  DISPONIVEL: { label: 'Disponível', className: 'status-livre' },
  EM_USO: { label: 'Em uso', className: 'status-ocupado' },
  EM_MANUTENCAO: { label: 'Em manutenção', className: 'status-manutencao' },
  INDISPONIVEL: { label: 'Indisponível', className: 'status-inativo' },
};

// Estados que o admin pode escolher manualmente; EM_USO vem da retirada
export const ESTADOS_MANUAIS = ['DISPONIVEL', 'EM_MANUTENCAO', 'INDISPONIVEL'];

// Recurso que não aceita pedidos no momento (em manutenção ou indisponível)
export function recursoBloqueado(recurso) {
  return recurso.estado === 'EM_MANUTENCAO' || recurso.estado === 'INDISPONIVEL';
}
