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

// Minutos de tolerância após o fim da reserva antes de considerá-la atrasada
export const TOLERANCIA_ATRASO_MIN = Number(process.env.TOLERANCIA_ATRASO_MIN ?? 15);

// Recurso retirado que já deveria ter voltado
export function estaAtrasada(r: { status: string; dataFim: Date }, agora = new Date()) {
  return (
    r.status === 'EM_ANDAMENTO' && r.dataFim.getTime() + TOLERANCIA_ATRASO_MIN * 60_000 < agora.getTime()
  );
}

// Quanto tempo antes do início o admin já pode entregar o recurso (minutos)
export const ANTECEDENCIA_RETIRADA_MIN = Number(process.env.ANTECEDENCIA_RETIRADA_MIN ?? 60);
