import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { violouSobreposicao } from '../lib/erros';
import { STATUS_SOLICITACAO, STATUS_OCUPANTES, ANTECEDENCIA_RETIRADA_MIN } from '../lib/status';
import type { StatusSolicitacao } from '../generated/prisma/enums';

type ReqComId = Request<{ id: string }>;

const incluirDetalhes = {
  recurso: { select: { id: true, nome: true, tipo: true, localizacao: true } },
  usuario: { select: { id: true, nome: true, email: true, perfil: true } },
  aprovadoPor: { select: { id: true, nome: true } },
  lancadoPor: { select: { id: true, nome: true } },
  retiradaRegistradaPor: { select: { id: true, nome: true } },
  devolucaoRegistradaPor: { select: { id: true, nome: true } },
} as const;

function parseData(valor: unknown) {
  const data = new Date(String(valor));
  return Number.isNaN(data.getTime()) ? null : data;
}

// Procura uma reserva ativa (aprovada ou em uso) do mesmo recurso cujo período
// se sobrepõe ao informado (início < fim existente e fim > início existente).
function buscarConflito(recursoId: string, inicio: Date, fim: Date, ignorarId?: string) {
  return prisma.solicitacao.findFirst({
    where: {
      recursoId,
      status: { in: STATUS_OCUPANTES },
      dataInicio: { lt: fim },
      dataFim: { gt: inicio },
      ...(ignorarId ? { id: { not: ignorarId } } : {}),
    },
  });
}

// Estados em que o recurso não aceita novos pedidos nem aprovações
const MOTIVO_BLOQUEIO: Partial<Record<string, string>> = {
  EM_MANUTENCAO: 'O recurso está em manutenção e não pode ser reservado no momento.',
  INDISPONIVEL: 'O recurso está indisponível e não pode ser reservado no momento.',
};

// Validações comuns à solicitação do usuário e à reserva lançada pelo admin.
// Devolve o período já convertido ou a mensagem de erro com o status HTTP.
type ResultadoValidacao =
  | { ok: true; inicio: Date; fim: Date }
  | { ok: false; status: number; error: string };

async function validarPedido(
  recursoId: unknown,
  dataInicio: unknown,
  dataFim: unknown
): Promise<ResultadoValidacao> {
  const inicio = parseData(dataInicio);
  const fim = parseData(dataFim);

  if (!recursoId || !inicio || !fim) {
    return { ok: false, status: 400, error: 'Informe o recurso, a data de início e a data de fim.' };
  }
  if (fim <= inicio) {
    return { ok: false, status: 400, error: 'O horário de fim deve ser depois do início.' };
  }
  if (inicio < new Date()) {
    return { ok: false, status: 400, error: 'Não é possível reservar um horário no passado.' };
  }

  const recurso = await prisma.recurso.findUnique({ where: { id: String(recursoId) } });
  if (!recurso || !recurso.ativo) {
    return { ok: false, status: 404, error: 'Recurso não encontrado ou inativo.' };
  }
  const bloqueio = MOTIVO_BLOQUEIO[recurso.estado];
  if (bloqueio) {
    return { ok: false, status: 409, error: bloqueio };
  }
  if (await buscarConflito(recurso.id, inicio, fim)) {
    return { ok: false, status: 409, error: 'O recurso já está reservado nesse horário.' };
  }

  return { ok: true, inicio, fim };
}

export async function criar(req: Request, res: Response) {
  const { recursoId, dataInicio, dataFim, observacao } = req.body;

  // O admin não pede para si mesmo: ele lança reservas já aprovadas
  if (req.usuario?.perfil === 'ADMIN') {
    return res.status(403).json({
      error: 'Administradores registram reservas pela tela de Aprovações.',
    });
  }

  try {
    const validacao = await validarPedido(recursoId, dataInicio, dataFim);
    if (!validacao.ok) {
      return res.status(validacao.status).json({ error: validacao.error });
    }
    const { inicio, fim } = validacao;

    const solicitacao = await prisma.solicitacao.create({
      data: {
        recursoId,
        usuarioId: req.usuario!.id,
        dataInicio: inicio,
        dataFim: fim,
        observacao: observacao?.trim() || null,
      },
      include: incluirDetalhes,
    });

    return res.status(201).json(solicitacao);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao criar solicitação.' });
  }
}

// Admin: registra uma reserva já aprovada, em nome de um usuário cadastrado
// ou como uso institucional (prova, reunião, evento).
export async function reservar(req: Request, res: Response) {
  const { recursoId, dataInicio, dataFim, observacao, usuarioId, institucional } = req.body;
  const adminId = req.usuario!.id;

  if (institucional && !observacao?.trim()) {
    return res.status(400).json({ error: 'Descreva a finalidade do uso institucional.' });
  }
  if (!institucional && !usuarioId) {
    return res.status(400).json({ error: 'Informe para quem é a reserva.' });
  }

  try {
    if (!institucional) {
      const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
      if (!usuario || usuario.perfil === 'ADMIN') {
        return res.status(400).json({ error: 'Usuário inválido para a reserva.' });
      }
    }

    const validacao = await validarPedido(recursoId, dataInicio, dataFim);
    if (!validacao.ok) {
      return res.status(validacao.status).json({ error: validacao.error });
    }
    const { inicio, fim } = validacao;

    const reserva = await prisma.solicitacao.create({
      data: {
        recursoId,
        usuarioId: institucional ? adminId : usuarioId,
        dataInicio: inicio,
        dataFim: fim,
        observacao: observacao?.trim() || null,
        status: 'APROVADA',
        institucional: Boolean(institucional),
        lancadoPorId: adminId,
        aprovadoPorId: adminId,
      },
      include: incluirDetalhes,
    });

    // Pedidos pendentes no mesmo horário agora vão colidir na aprovação;
    // o front avisa o admin para recusá-los.
    const pendentesConflitantes = await prisma.solicitacao.count({
      where: {
        recursoId,
        status: 'PENDENTE',
        dataInicio: { lt: fim },
        dataFim: { gt: inicio },
      },
    });

    return res.status(201).json({ ...reserva, pendentesConflitantes });
  } catch (error) {
    if (violouSobreposicao(error)) {
      return res.status(409).json({ error: 'O recurso já está reservado nesse horário.' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Erro ao registrar reserva.' });
  }
}

// Admin: desfaz uma reserva lançada por ele (ou outro admin) que ainda não terminou
export async function cancelarReserva(req: ReqComId, res: Response) {
  const { id } = req.params;

  try {
    const reserva = await prisma.solicitacao.findUnique({ where: { id } });

    if (!reserva || !reserva.lancadoPorId) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }
    if (reserva.status !== 'APROVADA' || reserva.dataFim < new Date()) {
      return res.status(409).json({ error: 'Esta reserva já foi retirada ou encerrada.' });
    }

    await prisma.solicitacao.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao cancelar reserva.' });
  }
}

export async function listarMinhas(req: Request, res: Response) {
  try {
    const solicitacoes = await prisma.solicitacao.findMany({
      where: { usuarioId: req.usuario!.id },
      include: incluirDetalhes,
      orderBy: { dataInicio: 'desc' },
    });

    return res.json(solicitacoes);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao listar solicitações.' });
  }
}

// Admin: todas as solicitações, com filtro opcional por status
export async function listarTodas(req: Request, res: Response) {
  const { status } = req.query;

  if (status && !STATUS_SOLICITACAO.includes(status as StatusSolicitacao)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }

  try {
    const solicitacoes = await prisma.solicitacao.findMany({
      where: status ? { status: status as StatusSolicitacao } : {},
      include: incluirDetalhes,
      orderBy: { dataInicio: 'asc' },
    });

    return res.json(solicitacoes);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao listar solicitações.' });
  }
}

// Horários já reservados (aprovados ou em uso) de um recurso num intervalo,
// usado pelo formulário para mostrar a disponibilidade antes de solicitar.
export async function ocupacao(req: Request, res: Response) {
  const { recursoId } = req.query;
  const inicio = parseData(req.query.inicio);
  const fim = parseData(req.query.fim);

  if (!recursoId || !inicio || !fim) {
    return res.status(400).json({ error: 'Informe recursoId, inicio e fim.' });
  }

  try {
    const reservas = await prisma.solicitacao.findMany({
      where: {
        recursoId: String(recursoId),
        status: { in: STATUS_OCUPANTES },
        dataInicio: { lt: fim },
        dataFim: { gt: inicio },
      },
      select: { id: true, dataInicio: true, dataFim: true },
      orderBy: { dataInicio: 'asc' },
    });

    return res.json(reservas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao consultar ocupação.' });
  }
}

export async function aprovar(req: ReqComId, res: Response) {
  const { id } = req.params;

  try {
    const solicitacao = await prisma.solicitacao.findUnique({
      where: { id },
      include: { recurso: { select: { estado: true } } },
    });

    if (!solicitacao) {
      return res.status(404).json({ error: 'Solicitação não encontrada.' });
    }
    if (solicitacao.status !== 'PENDENTE') {
      return res.status(409).json({ error: 'Apenas solicitações pendentes podem ser aprovadas.' });
    }
    const bloqueio = MOTIVO_BLOQUEIO[solicitacao.recurso.estado];
    if (bloqueio) {
      return res.status(409).json({ error: bloqueio });
    }

    // Outra solicitação pode ter sido aprovada para o mesmo horário depois desta
    // ser criada. A checagem dá uma mensagem clara; a constraint do banco cobre
    // o caso de duas aprovações simultâneas, que passariam ambas por aqui.
    const conflito = await buscarConflito(
      solicitacao.recursoId,
      solicitacao.dataInicio,
      solicitacao.dataFim,
      solicitacao.id
    );
    if (conflito) {
      return res.status(409).json({
        error: 'Já existe uma reserva aprovada nesse horário. Recuse esta solicitação.',
      });
    }

    const atualizada = await prisma.solicitacao.update({
      where: { id },
      data: { status: 'APROVADA', aprovadoPorId: req.usuario!.id },
      include: incluirDetalhes,
    });

    return res.json(atualizada);
  } catch (error) {
    if (violouSobreposicao(error)) {
      return res.status(409).json({
        error: 'Já existe uma reserva aprovada nesse horário. Recuse esta solicitação.',
      });
    }
    console.error(error);
    return res.status(500).json({ error: 'Erro ao aprovar solicitação.' });
  }
}

export async function recusar(req: ReqComId, res: Response) {
  const { id } = req.params;

  try {
    const solicitacao = await prisma.solicitacao.findUnique({ where: { id } });

    if (!solicitacao) {
      return res.status(404).json({ error: 'Solicitação não encontrada.' });
    }
    if (solicitacao.status !== 'PENDENTE') {
      return res.status(409).json({ error: 'Apenas solicitações pendentes podem ser recusadas.' });
    }

    const atualizada = await prisma.solicitacao.update({
      where: { id },
      data: { status: 'RECUSADA', aprovadoPorId: req.usuario!.id },
      include: incluirDetalhes,
    });

    return res.json(atualizada);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao recusar solicitação.' });
  }
}

// O próprio usuário desiste do pedido: uma solicitação pendente é excluída;
// uma reserva aprovada ainda não retirada é marcada como CANCELADA, para
// manter o histórico e liberar o horário.
export async function cancelar(req: ReqComId, res: Response) {
  const { id } = req.params;

  try {
    const solicitacao = await prisma.solicitacao.findUnique({ where: { id } });

    if (!solicitacao || solicitacao.usuarioId !== req.usuario!.id) {
      return res.status(404).json({ error: 'Solicitação não encontrada.' });
    }

    if (solicitacao.status === 'PENDENTE') {
      await prisma.solicitacao.delete({ where: { id } });
      return res.status(204).send();
    }

    if (solicitacao.status === 'APROVADA' && solicitacao.dataFim > new Date()) {
      const cancelada = await prisma.solicitacao.update({
        where: { id },
        data: { status: 'CANCELADA', canceladoEm: new Date() },
        include: incluirDetalhes,
      });
      return res.json(cancelada);
    }

    return res.status(409).json({
      error: 'Só é possível cancelar pedidos pendentes ou reservas aprovadas ainda não retiradas.',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao cancelar solicitação.' });
  }
}

// Admin: entrega o recurso ao responsável. A reserva passa a EM_ANDAMENTO e o
// recurso a EM_USO, na mesma transação.
export async function registrarRetirada(req: ReqComId, res: Response) {
  const { id } = req.params;
  const agora = new Date();

  try {
    const reserva = await prisma.solicitacao.findUnique({
      where: { id },
      include: { recurso: true },
    });

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }
    if (reserva.status !== 'APROVADA') {
      return res.status(409).json({ error: 'Apenas reservas aprovadas podem ser retiradas.' });
    }

    const liberadaEm = new Date(reserva.dataInicio.getTime() - ANTECEDENCIA_RETIRADA_MIN * 60_000);
    if (agora < liberadaEm) {
      return res.status(409).json({
        error: `A retirada só pode ser registrada a partir de ${ANTECEDENCIA_RETIRADA_MIN} minutos antes do início.`,
      });
    }
    if (agora >= reserva.dataFim) {
      return res.status(409).json({ error: 'O horário desta reserva já terminou.' });
    }
    if (reserva.recurso.estado === 'EM_USO') {
      return res.status(409).json({ error: 'O recurso ainda não foi devolvido pelo uso anterior.' });
    }
    if (reserva.recurso.estado !== 'DISPONIVEL') {
      return res.status(409).json({ error: 'O recurso está em manutenção ou indisponível.' });
    }

    const [atualizada] = await prisma.$transaction([
      prisma.solicitacao.update({
        where: { id },
        data: {
          status: 'EM_ANDAMENTO',
          retiradoEm: agora,
          retiradaRegistradaPorId: req.usuario!.id,
        },
        include: incluirDetalhes,
      }),
      prisma.recurso.update({ where: { id: reserva.recursoId }, data: { estado: 'EM_USO' } }),
    ]);

    return res.json(atualizada);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao registrar a retirada.' });
  }
}

// Admin: recebe o recurso de volta. A reserva é concluída e o recurso volta a
// ficar disponível. Uma devolução antecipada libera o restante do horário.
export async function registrarDevolucao(req: ReqComId, res: Response) {
  const { id } = req.params;

  try {
    const reserva = await prisma.solicitacao.findUnique({ where: { id } });

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }
    if (reserva.status !== 'EM_ANDAMENTO') {
      return res.status(409).json({ error: 'Apenas recursos retirados podem ser devolvidos.' });
    }

    const [atualizada] = await prisma.$transaction([
      prisma.solicitacao.update({
        where: { id },
        data: {
          status: 'CONCLUIDA',
          devolvidoEm: new Date(),
          devolucaoRegistradaPorId: req.usuario!.id,
        },
        include: incluirDetalhes,
      }),
      prisma.recurso.update({ where: { id: reserva.recursoId }, data: { estado: 'DISPONIVEL' } }),
    ]);

    return res.json(atualizada);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao registrar a devolução.' });
  }
}

// Admin: painel do balcão. Reservas do dia aguardando retirada, tudo o que está
// com alguém agora (inclusive atrasos de dias anteriores) e as devoluções de hoje.
export async function movimentacoes(req: Request, res: Response) {
  const agora = new Date();
  const inicioDoDia = new Date(agora);
  inicioDoDia.setHours(0, 0, 0, 0);
  const fimDoDia = new Date(inicioDoDia);
  fimDoDia.setDate(fimDoDia.getDate() + 1);

  try {
    const [aguardandoRetirada, emUso, devolvidasHoje] = await Promise.all([
      prisma.solicitacao.findMany({
        where: { status: 'APROVADA', dataInicio: { lt: fimDoDia }, dataFim: { gt: agora } },
        include: incluirDetalhes,
        orderBy: { dataInicio: 'asc' },
      }),
      prisma.solicitacao.findMany({
        where: { status: 'EM_ANDAMENTO' },
        include: incluirDetalhes,
        orderBy: { dataFim: 'asc' },
      }),
      prisma.solicitacao.findMany({
        where: { status: 'CONCLUIDA', devolvidoEm: { gte: inicioDoDia } },
        include: incluirDetalhes,
        orderBy: { devolvidoEm: 'desc' },
      }),
    ]);

    return res.json({ geradoEm: agora, aguardandoRetirada, emUso, devolvidasHoje });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao carregar retiradas e devoluções.' });
  }
}
