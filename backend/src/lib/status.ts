import type { StatusSolicitacao } from '../generated/prisma/enums';

export const STATUS_SOLICITACAO: StatusSolicitacao[] = [
  'PENDENTE',
  'APROVADA',
  'RECUSADA',
  'EM_ANDAMENTO',
  'CONCLUIDA',
  'CANCELADA',
];

// Reservas que ocupam o horário do recurso: aprovadas e já retiradas.
// É o mesmo conjunto coberto pela constraint Solicitacao_sem_sobreposicao.
export const STATUS_OCUPANTES: StatusSolicitacao[] = ['APROVADA', 'EM_ANDAMENTO'];

// Quanto tempo antes do início o admin já pode entregar o recurso (minutos)
export const ANTECEDENCIA_RETIRADA_MIN = Number(process.env.ANTECEDENCIA_RETIRADA_MIN ?? 60);
