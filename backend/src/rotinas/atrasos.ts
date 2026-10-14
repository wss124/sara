import { prisma } from '../lib/prisma';
import { TOLERANCIA_ATRASO_MIN } from '../lib/status';
import * as notificar from '../emails/notificacoes';

const detalhes = {
  usuario: { select: { nome: true, email: true } },
  recurso: { select: { nome: true, localizacao: true } },
  acessorios: { include: { acessorio: { select: { nome: true, localizacao: true } } } },
} as const;

// Reservas em uso cujo fim (mais a tolerância) já passou e que ainda não
// geraram aviso. Cada uma é "reivindicada" com um update condicional antes do
// envio, então o aviso sai uma única vez mesmo com reinícios do servidor.
export async function avisarAtrasos(agora = new Date()) {
  const limite = new Date(agora.getTime() - TOLERANCIA_ATRASO_MIN * 60_000);
  const atrasadas = await prisma.solicitacao.findMany({
    where: { status: 'EM_ANDAMENTO', dataFim: { lt: limite }, avisoAtrasoEnviadoEm: null },
    include: detalhes,
  });

  let avisadas = 0;
  for (const reserva of atrasadas) {
    const { count } = await prisma.solicitacao.updateMany({
      where: { id: reserva.id, avisoAtrasoEnviadoEm: null },
      data: { avisoAtrasoEnviadoEm: agora },
    });
    if (count === 0) continue;

    // A próxima reserva do mesmo recurso corre risco de ficar sem ele
    const proxima = await prisma.solicitacao.findFirst({
      where: { recursoId: reserva.recursoId, status: 'APROVADA', dataFim: { gt: agora } },
      include: detalhes,
      orderBy: { dataInicio: 'asc' },
    });
    notificar.devolucaoAtrasada(reserva, proxima);
    avisadas += 1;
  }
  return avisadas;
}
