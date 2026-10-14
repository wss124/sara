import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { STATUS_OCUPANTES, estaAtrasada } from '../lib/status';

// Situação de um recurso no painel, combinando o estado físico com a agenda:
// em manutenção/indisponível vence tudo; depois, se está com alguém (em uso ou
// atrasado); depois, se há reserva valendo agora mas ninguém retirou ainda.
type Situacao =
  | 'LIVRE'
  | 'AGUARDANDO_RETIRADA'
  | 'EM_USO'
  | 'ATRASADO'
  | 'EM_MANUTENCAO'
  | 'INDISPONIVEL';

const SITUACOES_OCUPADAS: Situacao[] = ['AGUARDANDO_RETIRADA', 'EM_USO', 'ATRASADO'];

const camposReserva = {
  id: true,
  status: true,
  dataInicio: true,
  dataFim: true,
  institucional: true,
  observacao: true,
  retiradoEm: true,
  usuario: { select: { nome: true } },
} as const;

// Resumo usado pelo dashboard: indicadores do usuário, situação atual de cada
// recurso ativo e a agenda de hoje.
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
          foto: true,
          estado: true,
          localizacao: true,
          solicitacoes: {
            // O que está com alguém (mesmo atrasado) e o que ainda vai acontecer
            where: {
              OR: [{ status: 'EM_ANDAMENTO' }, { status: 'APROVADA', dataFim: { gt: agora } }],
            },
            select: camposReserva,
            orderBy: { dataInicio: 'asc' },
            take: 3,
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
          status: { in: [...STATUS_OCUPANTES, 'CONCLUIDA'] },
          dataInicio: { lt: fimDoDia },
          dataFim: { gt: inicioDoDia },
        },
        select: {
          ...camposReserva,
          devolvidoEm: true,
          recurso: { select: { id: true, nome: true, tipo: true, foto: true } },
        },
        orderBy: { dataInicio: 'asc' },
      }),
    ]);

    const ocupacao = recursos.map(({ solicitacoes, ...recurso }) => {
      const emUso = solicitacoes.find((s) => s.status === 'EM_ANDAMENTO') ?? null;
      const aguardando =
        solicitacoes.find((s) => s.status === 'APROVADA' && s.dataInicio <= agora) ?? null;
      const proxima =
        solicitacoes.find((s) => s.status === 'APROVADA' && s.dataInicio > agora) ?? null;

      let situacao: Situacao = 'LIVRE';
      if (recurso.estado === 'EM_MANUTENCAO' || recurso.estado === 'INDISPONIVEL') {
        situacao = recurso.estado;
      } else if (emUso) {
        situacao = estaAtrasada(emUso, agora) ? 'ATRASADO' : 'EM_USO';
      } else if (aguardando) {
        situacao = 'AGUARDANDO_RETIRADA';
      }

      return {
        ...recurso,
        situacao,
        ocupadoAgora: SITUACOES_OCUPADAS.includes(situacao),
        atual: emUso ?? aguardando,
        proxima,
      };
    });

    const contar = (situacao: Situacao) => ocupacao.filter((r) => r.situacao === situacao).length;
    const contagem = Object.fromEntries(
      minhasPorStatus.map(({ status, _count }) => [status, _count._all])
    );

    return res.json({
      geradoEm: agora,
      recursos: {
        total: ocupacao.length,
        ocupados: ocupacao.filter((r) => r.ocupadoAgora).length,
        livres: contar('LIVRE'),
        emUso: contar('EM_USO'),
        aguardandoRetirada: contar('AGUARDANDO_RETIRADA'),
        atrasados: contar('ATRASADO'),
        emManutencao: contar('EM_MANUTENCAO'),
        indisponiveis: contar('INDISPONIVEL'),
      },
      minhas: {
        pendentes: contagem.PENDENTE ?? 0,
        aprovadas: contagem.APROVADA ?? 0,
        emUso: contagem.EM_ANDAMENTO ?? 0,
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
