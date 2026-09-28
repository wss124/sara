import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

type ReqComId = Request<{ id: string }>;

const TIPOS_VALIDOS = ['SALA', 'EQUIPAMENTO'];

// Lista os recursos indicando se cada um está ocupado neste momento
// (existe uma solicitação aprovada cobrindo o horário atual).
// Usuários comuns veem apenas recursos ativos; o admin vê todos.
export async function listar(req: Request, res: Response) {
  const { tipo, busca } = req.query;
  const agora = new Date();
  const isAdmin = req.usuario?.perfil === 'ADMIN';

  if (tipo && !TIPOS_VALIDOS.includes(String(tipo))) {
    return res.status(400).json({ error: 'Tipo de recurso inválido.' });
  }

  try {
    const recursos = await prisma.recurso.findMany({
      where: {
        ...(isAdmin ? {} : { ativo: true }),
        ...(tipo ? { tipo: tipo as 'SALA' | 'EQUIPAMENTO' } : {}),
        ...(busca ? { nome: { contains: String(busca), mode: 'insensitive' as const } } : {}),
      },
      include: {
        solicitacoes: {
          where: {
            status: 'APROVADA',
            dataInicio: { lte: agora },
            dataFim: { gte: agora },
          },
          select: { id: true },
        },
      },
      orderBy: { nome: 'asc' },
    });

    return res.json(
      recursos.map(({ solicitacoes, ...recurso }) => ({
        ...recurso,
        ocupadoAgora: solicitacoes.length > 0,
      }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao listar recursos.' });
  }
}

export async function buscarPorId(req: ReqComId, res: Response) {
  const { id } = req.params;

  try {
    const recurso = await prisma.recurso.findUnique({ where: { id } });

    if (!recurso || (!recurso.ativo && req.usuario?.perfil !== 'ADMIN')) {
      return res.status(404).json({ error: 'Recurso não encontrado.' });
    }

    return res.json(recurso);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao buscar recurso.' });
  }
}

export async function criar(req: Request, res: Response) {
  const { nome, tipo, descricao } = req.body;

  if (!nome?.trim() || !TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ error: 'Informe o nome e um tipo válido (SALA ou EQUIPAMENTO).' });
  }

  try {
    const recurso = await prisma.recurso.create({
      data: { nome: nome.trim(), tipo, descricao: descricao?.trim() || null },
    });

    return res.status(201).json(recurso);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao criar recurso.' });
  }
}

export async function atualizar(req: ReqComId, res: Response) {
  const { id } = req.params;
  const { nome, tipo, descricao, ativo } = req.body;

  if (nome !== undefined && !nome?.trim()) {
    return res.status(400).json({ error: 'O nome não pode ficar vazio.' });
  }
  if (tipo !== undefined && !TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ error: 'Tipo de recurso inválido.' });
  }

  try {
    const existe = await prisma.recurso.findUnique({ where: { id } });

    if (!existe) {
      return res.status(404).json({ error: 'Recurso não encontrado.' });
    }

    const recurso = await prisma.recurso.update({
      where: { id },
      data: {
        ...(nome !== undefined ? { nome: nome.trim() } : {}),
        ...(tipo !== undefined ? { tipo } : {}),
        ...(descricao !== undefined ? { descricao: descricao?.trim() || null } : {}),
        ...(typeof ativo === 'boolean' ? { ativo } : {}),
      },
    });

    return res.json(recurso);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao atualizar recurso.' });
  }
}

// Recursos com histórico de solicitações não são apagados, para preservar
// o histórico; nesse caso o admin deve desativá-los.
export async function remover(req: ReqComId, res: Response) {
  const { id } = req.params;

  try {
    const recurso = await prisma.recurso.findUnique({
      where: { id },
      include: { _count: { select: { solicitacoes: true } } },
    });

    if (!recurso) {
      return res.status(404).json({ error: 'Recurso não encontrado.' });
    }

    if (recurso._count.solicitacoes > 0) {
      return res.status(409).json({
        error: 'Este recurso possui solicitações registradas. Desative-o em vez de excluir.',
      });
    }

    await prisma.recurso.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao remover recurso.' });
  }
}
