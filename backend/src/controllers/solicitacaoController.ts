import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

type ReqComId = Request<{ id: string }>;

const STATUS_VALIDOS = ['PENDENTE', 'APROVADA', 'RECUSADA'];

const incluirDetalhes = {
  recurso: { select: { id: true, nome: true, tipo: true } },
  usuario: { select: { id: true, nome: true, email: true, perfil: true } },
  aprovadoPor: { select: { id: true, nome: true } },
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

export async function criar(req: Request, res: Response) {
  const { recursoId, dataInicio, dataFim, observacao } = req.body;
  const inicio = parseData(dataInicio);
  const fim = parseData(dataFim);

  if (!recursoId || !inicio || !fim) {
    return res.status(400).json({ error: 'Informe o recurso, a data de início e a data de fim.' });
  }
  if (fim <= inicio) {
    return res.status(400).json({ error: 'O horário de fim deve ser depois do início.' });
  }
  if (inicio < new Date()) {
    return res.status(400).json({ error: 'Não é possível solicitar um horário no passado.' });
  }

  try {
    const recurso = await prisma.recurso.findUnique({ where: { id: recursoId } });

    if (!recurso || !recurso.ativo) {
      return res.status(404).json({ error: 'Recurso não encontrado ou inativo.' });
    }

    if (await buscarConflito(recursoId, inicio, fim)) {
      return res.status(409).json({ error: 'O recurso já está reservado nesse horário.' });
    }

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

    // Outra solicitação pode ter sido aprovada para o mesmo horário depois desta ser criada
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
