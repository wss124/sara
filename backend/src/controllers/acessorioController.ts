import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { unidadesLivres } from '../lib/estoqueAcessorios';

type ReqComId = Request<{ id: string }>;

function quantidadeValida(valor: unknown) {
  return Number.isInteger(valor) && (valor as number) >= 1;
}

// Lista os acessórios com os recursos que cada um acompanha.
// Usuários comuns veem apenas os ativos; o admin vê todos.
export async function listar(req: Request, res: Response) {
  const isAdmin = req.usuario?.perfil === 'ADMIN';

  try {
    const acessorios = await prisma.acessorio.findMany({
      where: isAdmin ? {} : { ativo: true },
      include: {
        recursos: { include: { recurso: { select: { id: true, nome: true } } } },
      },
      orderBy: { nome: 'asc' },
    });

    return res.json(
      acessorios.map(({ recursos, ...acessorio }) => ({
        ...acessorio,
        recursos: recursos.map((r) => ({ ...r.recurso, obrigatorio: r.obrigatorio })),
      }))
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao listar acessórios.' });
  }
}

export async function criar(req: Request, res: Response) {
  const { nome, descricao, localizacao, quantidade = 1 } = req.body;

  if (!nome?.trim()) {
    return res.status(400).json({ error: 'Informe o nome do acessório.' });
  }
  if (!quantidadeValida(quantidade)) {
    return res.status(400).json({ error: 'A quantidade deve ser um número inteiro maior que zero.' });
  }

  try {
    const acessorio = await prisma.acessorio.create({
      data: {
        nome: nome.trim(),
        descricao: descricao?.trim() || null,
        localizacao: localizacao?.trim() || null,
        quantidade,
      },
    });

    return res.status(201).json(acessorio);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao criar acessório.' });
  }
}

export async function atualizar(req: ReqComId, res: Response) {
  const { id } = req.params;
  const { nome, descricao, localizacao, quantidade, ativo } = req.body;

  if (nome !== undefined && !nome?.trim()) {
    return res.status(400).json({ error: 'O nome não pode ficar vazio.' });
  }
  if (quantidade !== undefined && !quantidadeValida(quantidade)) {
    return res.status(400).json({ error: 'A quantidade deve ser um número inteiro maior que zero.' });
  }

  try {
    const existe = await prisma.acessorio.findUnique({ where: { id } });

    if (!existe) {
      return res.status(404).json({ error: 'Acessório não encontrado.' });
    }

    const acessorio = await prisma.acessorio.update({
      where: { id },
      data: {
        ...(nome !== undefined ? { nome: nome.trim() } : {}),
        ...(descricao !== undefined ? { descricao: descricao?.trim() || null } : {}),
        ...(localizacao !== undefined ? { localizacao: localizacao?.trim() || null } : {}),
        ...(quantidade !== undefined ? { quantidade } : {}),
        ...(typeof ativo === 'boolean' ? { ativo } : {}),
      },
    });

    return res.json(acessorio);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao atualizar acessório.' });
  }
}

// Acessório que já saiu em alguma reserva fica no histórico: deve ser desativado
export async function remover(req: ReqComId, res: Response) {
  const { id } = req.params;

  try {
    const acessorio = await prisma.acessorio.findUnique({
      where: { id },
      include: { _count: { select: { solicitacoes: true } } },
    });

    if (!acessorio) {
      return res.status(404).json({ error: 'Acessório não encontrado.' });
    }
    if (acessorio._count.solicitacoes > 0) {
      return res.status(409).json({
        error: 'Este acessório já foi usado em reservas. Desative-o em vez de excluir.',
      });
    }

    await prisma.acessorio.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao remover acessório.' });
  }
}

// Admin: unidades que estavam em falta foram encontradas ou repostas.
// Corpo opcional { quantidade }; sem ele, zera o que está em falta.
export async function regularizar(req: ReqComId, res: Response) {
  const { id } = req.params;
  const quantidade = req.body?.quantidade;

  if (quantidade !== undefined && !quantidadeValida(quantidade)) {
    return res.status(400).json({ error: 'A quantidade deve ser um número inteiro maior que zero.' });
  }

  try {
    const acessorio = await prisma.acessorio.findUnique({ where: { id } });

    if (!acessorio) {
      return res.status(404).json({ error: 'Acessório não encontrado.' });
    }

    const atualizado = await prisma.acessorio.update({
      where: { id },
      data: { emFalta: quantidade === undefined ? 0 : Math.max(0, acessorio.emFalta - quantidade) },
    });

    return res.json(atualizado);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao regularizar o acessório.' });
  }
}

// Admin: define o kit que acompanha um recurso, substituindo o anterior.
// Corpo: { itens: [{ acessorioId, obrigatorio }] }
export async function definirKit(req: ReqComId, res: Response) {
  const { id } = req.params;
  const itens = req.body?.itens;

  if (
    !Array.isArray(itens) ||
    itens.some((i) => typeof i?.acessorioId !== 'string' || typeof i?.obrigatorio !== 'boolean')
  ) {
    return res.status(400).json({ error: 'Envie a lista de itens: [{ acessorioId, obrigatorio }].' });
  }
  const ids = itens.map((i) => i.acessorioId as string);
  if (new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: 'Um acessório aparece mais de uma vez no kit.' });
  }

  try {
    const recurso = await prisma.recurso.findUnique({ where: { id } });
    if (!recurso) {
      return res.status(404).json({ error: 'Recurso não encontrado.' });
    }
    const encontrados = await prisma.acessorio.count({ where: { id: { in: ids } } });
    if (encontrados !== ids.length) {
      return res.status(400).json({ error: 'Algum acessório do kit não existe.' });
    }

    await prisma.$transaction([
      prisma.recursoAcessorio.deleteMany({ where: { recursoId: id } }),
      prisma.recursoAcessorio.createMany({
        data: itens.map((i) => ({ recursoId: id, acessorioId: i.acessorioId, obrigatorio: i.obrigatorio })),
      }),
    ]);

    return res.json(await buscarKit(id));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao salvar os acessórios do recurso.' });
  }
}

// Kit do recurso com as unidades livres de cada item num período, para o
// formulário de pedido desabilitar o que não está disponível.
export async function disponibilidade(req: Request, res: Response) {
  const recursoId = String(req.query.recursoId ?? '');
  const inicio = new Date(String(req.query.inicio));
  const fim = new Date(String(req.query.fim));

  if (!recursoId || Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
    return res.status(400).json({ error: 'Informe recursoId, inicio e fim.' });
  }

  try {
    const kit = await buscarKit(recursoId, true);
    const livres = await unidadesLivres(
      prisma,
      kit.map((a) => a.id),
      inicio,
      fim
    );
    return res.json(kit.map((a) => ({ ...a, livres: livres.get(a.id)?.livres ?? 0 })));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao consultar os acessórios.' });
  }
}

// Kit de um recurso no formato usado pela API: obrigatórios primeiro
export async function buscarKit(recursoId: string, somenteAtivos = false) {
  const itens = await prisma.recursoAcessorio.findMany({
    where: { recursoId, ...(somenteAtivos ? { acessorio: { ativo: true } } : {}) },
    include: { acessorio: true },
    orderBy: [{ obrigatorio: 'desc' }, { acessorio: { nome: 'asc' } }],
  });
  return itens.map(({ acessorio, obrigatorio }) => ({ ...acessorio, obrigatorio }));
}
