import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

// Resumo usado pelo dashboard: indicadores do usuário, situação atual de cada
// recurso ativo (em uso agora / próxima reserva) e a agenda aprovada de hoje.
export async function resumo(req: Request, res: Response) {
  const agora = new Date();
  const inicioDoDia = new Date(agora);
  inicioDoDia.setHours(0, 0, 0, 0);
  const fimDoDia = new Date(inicioDoDia);
  fimDoDia.setDate(fimDoDia.getDate() + 1);

  const isAdmin = req.usuario?.perfil === 'ADMIN';

  try {
    const [recursos, minhasPorStatus, pendentesGerais, reservasHoje] = await Promise.all([
      prisma.recurso.findMany({
        where: { ativo: true },
        select: {
          id: true,
          nome: true,
          tipo: true,
          solicitacoes: {
            where: { status: 'APROVADA', dataFim: { gt: agora } },
            select: {
              id: true,
              dataInicio: true,
              dataFim: true,
              usuario: { select: { nome: true } },
            },
            orderBy: { dataInicio: 'asc' },
            take: 2,
          },
        },
        orderBy: { nome: 'asc' },
      }),
      prisma.solicitacao.groupBy({
        by: ['status'],
        where: { usuarioId: req.usuario!.id },
        _count: { _all: true },
      }),
      isAdmin ? prisma.solicitacao.count({ where: { status: 'PENDENTE' } }) : Promise.resolve(null),
      prisma.solicitacao.findMany({
        where: {
          status: 'APROVADA',
          dataInicio: { lt: fimDoDia },
          dataFim: { gt: inicioDoDia },
        },
        select: {
          id: true,
          dataInicio: true,
          dataFim: true,
          recurso: { select: { id: true, nome: true, tipo: true } },
          usuario: { select: { nome: true } },
        },
        orderBy: { dataInicio: 'asc' },
      }),
    ]);

    // As reservas vêm ordenadas e sem sobreposição: se a primeira já começou,
    // ela é a reserva atual e a seguinte é a próxima.
    const ocupacao = recursos.map(({ solicitacoes, ...recurso }) => {
      const [primeira, segunda] = solicitacoes;
      const atual = primeira && primeira.dataInicio <= agora ? primeira : null;
      const proxima = atual ? segunda ?? null : primeira ?? null;
      return { ...recurso, ocupadoAgora: Boolean(atual), atual, proxima };
    });

    const contagem = Object.fromEntries(
      minhasPorStatus.map(({ status, _count }) => [status, _count._all])
    );

    return res.json({
      geradoEm: agora,
      recursos: {
        total: ocupacao.length,
        ocupados: ocupacao.filter((r) => r.ocupadoAgora).length,
      },
      minhas: {
        pendentes: contagem.PENDENTE ?? 0,
        aprovadas: contagem.APROVADA ?? 0,
        recusadas: contagem.RECUSADA ?? 0,
      },
      pendentesGerais,
      ocupacao,
      reservasHoje,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao carregar o dashboard.' });
  }
}
