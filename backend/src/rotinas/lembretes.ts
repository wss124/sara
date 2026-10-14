import { prisma } from '../lib/prisma';
import { inicioDoDiaNoFuso, dataNoFuso, horaNoFuso } from '../lib/fuso';
import * as notificar from '../emails/notificacoes';

// Minutos de antecedência de cada lembrete e hora local do resumo diário
const LEMBRETE_RETIRADA_MIN = Number(process.env.LEMBRETE_RETIRADA_MIN ?? 60);
const LEMBRETE_DEVOLUCAO_MIN = Number(process.env.LEMBRETE_DEVOLUCAO_MIN ?? 15);
const HORA_RESUMO_DIARIO = Number(process.env.HORA_RESUMO_DIARIO ?? 7);

const detalhes = {
  usuario: { select: { nome: true, email: true } },
  recurso: { select: { nome: true, localizacao: true } },
  acessorios: { include: { acessorio: { select: { nome: true, localizacao: true } } } },
} as const;

const minutos = (agora: Date, n: number) => new Date(agora.getTime() + n * 60_000);

// Reservas aprovadas que começam nos próximos minutos: lembra de retirar
export async function lembrarRetiradas(agora = new Date()) {
  const reservas = await prisma.solicitacao.findMany({
    where: {
      status: 'APROVADA',
      dataInicio: { gt: agora, lte: minutos(agora, LEMBRETE_RETIRADA_MIN) },
      lembreteRetiradaEnviadoEm: null,
    },
    include: detalhes,
  });

  let enviados = 0;
  for (const reserva of reservas) {
    // Reivindica o envio antes de mandar: só um processo envia cada lembrete
    const { count } = await prisma.solicitacao.updateMany({
      where: { id: reserva.id, lembreteRetiradaEnviadoEm: null },
      data: { lembreteRetiradaEnviadoEm: agora },
    });
    if (count === 0) continue;
    notificar.lembreteRetirada(reserva);
    enviados += 1;
  }
  return enviados;
}

// Recursos em uso cuja reserva termina nos próximos minutos: lembra de devolver
export async function lembrarDevolucoes(agora = new Date()) {
  const reservas = await prisma.solicitacao.findMany({
    where: {
      status: 'EM_ANDAMENTO',
      dataFim: { gt: agora, lte: minutos(agora, LEMBRETE_DEVOLUCAO_MIN) },
      lembreteDevolucaoEnviadoEm: null,
    },
    include: detalhes,
  });

  let enviados = 0;
  for (const reserva of reservas) {
    const { count } = await prisma.solicitacao.updateMany({
      where: { id: reserva.id, lembreteDevolucaoEnviadoEm: null },
      data: { lembreteDevolucaoEnviadoEm: agora },
    });
    if (count === 0) continue;
    notificar.lembreteDevolucao(reserva);
    enviados += 1;
  }
  return enviados;
}

// Uma vez por dia, a partir da hora configurada (horário do campus): retiradas
// previstas, recursos fora e pedidos pendentes. A chave com a data impede um
// segundo envio no mesmo dia, mesmo se o servidor reiniciar.
export async function enviarResumoDiario(agora = new Date()) {
  if (horaNoFuso(agora) < HORA_RESUMO_DIARIO) return false;

  try {
    await prisma.rotinaExecucao.create({ data: { chave: `resumo-diario-${dataNoFuso(agora)}` } });
  } catch {
    return false; // já enviado hoje
  }

  const inicioDoDia = inicioDoDiaNoFuso(agora);
  const fimDoDia = new Date(inicioDoDia.getTime() + 24 * 60 * 60_000);
  const [retiradas, emUso, pendentes] = await Promise.all([
    prisma.solicitacao.findMany({
      where: { status: 'APROVADA', dataInicio: { gte: inicioDoDia, lt: fimDoDia } },
      include: detalhes,
      orderBy: { dataInicio: 'asc' },
    }),
    prisma.solicitacao.findMany({
      where: { status: 'EM_ANDAMENTO' },
      include: detalhes,
      orderBy: { dataFim: 'asc' },
    }),
    prisma.solicitacao.count({ where: { status: 'PENDENTE' } }),
  ]);

  notificar.resumoDiario({ retiradas, emUso, pendentes });
  return true;
}
