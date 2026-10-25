import capaSala from '../assets/recursos/sala.svg';
import capaEquipamento from '../assets/recursos/equipamento.svg';
import { urlFotoRecurso } from '../services/recursoService';

export const CAPAS_PADRAO = {
  SALA: capaSala,
  EQUIPAMENTO: capaEquipamento,
};

// Foto enviada pelo admin ou, na falta dela, a capa padrão do tipo
export function capaDoRecurso(recurso) {
  return urlFotoRecurso(recurso.foto) || CAPAS_PADRAO[recurso.tipo];
}
