import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { violouSobreposicao } from '../lib/erros';

type ReqComId = Request<{ id: string }>;

const STATUS_VALIDOS = ['PENDENTE', 'APROVADA', 'RECUSADA'];

const incluirDetalhes = {
  recurso: { select: { id: true, nome: true, tipo: true } },
  usuario: { select: { id: true, nome: true, email: true, perfil: true } },
  aprovadoPor: { select: { id: true, nome: true } },
  lancadoPor: { select: { id: true, nome: true } },
} as const;

function parseData(valor: unknown) {
  const data = new Date(String(valor));
  return Number.isNaN(data.getTime()) ? null : data;
}

// Procura uma solicitação aprovada do mesmo recurso cujo período se sobrepõe
// ao informado (início < fim existente e fim > início existente).
function buscarConflito(recursoId: string, inicio: Date, fim: Date, ignorarId?: string) {
  return prisma.solicitacao.findFirst({
    where: {
      recursoId,
      status: 'APROVADA',
      dataInicio: { lt: fim },
      dataFim: { gt: inicio },
      ...(ignorarId ? { id: { not: ignorarId } } : {}),
    },
  });
}

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
    if (reserva.dataFim < new Date()) {
      return res.status(409).json({ error: 'Esta reserva já foi encerrada.' });
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

  if (status && !STATUS_VALIDOS.includes(String(status))) {
    return res.status(400).json({ error: 'Status inválido.' });
  }

  try {
    const solicitacoes = await prisma.solicitacao.findMany({
      where: status ? { status: status as 'PENDENTE' | 'APROVADA' | 'RECUSADA' } : {},
      include: incluirDetalhes,
      orderBy: { dataInicio: 'asc' },
    });

    return res.json(solicitacoes);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao listar solicitações.' });
  }
}

// Horários já reservados (aprovados) de um recurso num intervalo,
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
        status: 'APROVADA',
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
    const solicitacao = await prisma.solicitacao.findUnique({ where: { id } });

    if (!solicitacao) {
      return res.status(404).json({ error: 'Solicitação não encontrada.' });
    }
    if (solicitacao.status !== 'PENDENTE') {
      return res.status(409).json({ error: 'Apenas solicitações pendentes podem ser aprovadas.' });
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

// O próprio usuário pode cancelar (excluir) uma solicitação ainda pendente
export async function cancelar(req: ReqComId, res: Response) {
  const { id } = req.params;

  try {
    const solicitacao = await prisma.solicitacao.findUnique({ where: { id } });

    if (!solicitacao || solicitacao.usuarioId !== req.usuario!.id) {
      return res.status(404).json({ error: 'Solicitação não encontrada.' });
    }
    if (solicitacao.status !== 'PENDENTE') {
      return res.status(409).json({ error: 'Apenas solicitações pendentes podem ser canceladas.' });
    }

    await prisma.solicitacao.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao cancelar solicitação.' });
  }
}
