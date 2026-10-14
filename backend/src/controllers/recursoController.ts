import { Request, Response } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { uploadFoto, caminhoPublico, apagarFoto } from '../lib/upload';
import { STATUS_OCUPANTES } from '../lib/status';
import { buscarReservasFuturas } from './solicitacaoController';
import { buscarKit } from './acessorioController';

// Kit do recurso para a listagem; quem não é admin não vê acessórios inativos
function incluirKit(isAdmin: boolean) {
  return {
    where: isAdmin ? {} : { acessorio: { ativo: true } },
    include: { acessorio: { select: { id: true, nome: true, localizacao: true, ativo: true } } },
    orderBy: [{ obrigatorio: 'desc' as const }, { acessorio: { nome: 'asc' as const } }],
  };
}

type ReqComId = Request<{ id: string }>;

const TIPOS_VALIDOS = ['SALA', 'EQUIPAMENTO'];

// Estados que o admin pode definir manualmente. EM_USO só é atingido ao
// registrar a retirada do recurso, e só sai dele na devolução.
const ESTADOS_MANUAIS = ['DISPONIVEL', 'EM_MANUTENCAO', 'INDISPONIVEL'] as const;
type EstadoManual = (typeof ESTADOS_MANUAIS)[number];

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
            status: { in: STATUS_OCUPANTES },
            dataInicio: { lte: agora },
            dataFim: { gte: agora },
          },
          select: { id: true },
        },
        acessorios: incluirKit(isAdmin),
      },
      orderBy: { nome: 'asc' },
    });

    return res.json(
      recursos.map(({ solicitacoes, acessorios, ...recurso }) => ({
        ...recurso,
        ocupadoAgora: solicitacoes.length > 0,
        acessorios: acessorios.map((a) => ({ ...a.acessorio, obrigatorio: a.obrigatorio })),
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

    const isAdmin = req.usuario?.perfil === 'ADMIN';
    if (!recurso || (!recurso.ativo && !isAdmin)) {
      return res.status(404).json({ error: 'Recurso não encontrado.' });
    }

    return res.json({ ...recurso, acessorios: await buscarKit(id, !isAdmin) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao buscar recurso.' });
  }
}

export async function criar(req: Request, res: Response) {
  const { nome, tipo, descricao, localizacao } = req.body;

  if (!nome?.trim() || !TIPOS_VALIDOS.includes(tipo)) {
    return res.status(400).json({ error: 'Informe o nome e um tipo válido (SALA ou EQUIPAMENTO).' });
  }

  try {
    const recurso = await prisma.recurso.create({
      data: {
        nome: nome.trim(),
        tipo,
        descricao: descricao?.trim() || null,
        localizacao: localizacao?.trim() || null,
      },
    });

    return res.status(201).json(recurso);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao criar recurso.' });
  }
}

export async function atualizar(req: ReqComId, res: Response) {
  const { id } = req.params;
  const { nome, tipo, descricao, localizacao, ativo } = req.body;

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
        ...(localizacao !== undefined ? { localizacao: localizacao?.trim() || null } : {}),
        ...(typeof ativo === 'boolean' ? { ativo } : {}),
      },
    });

    return res.json(recurso);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao atualizar recurso.' });
  }
}

// Admin: coloca o recurso em manutenção, indisponível ou de volta a disponível
export async function alterarEstado(req: ReqComId, res: Response) {
  const { id } = req.params;
  const { estado } = req.body;

  if (!ESTADOS_MANUAIS.includes(estado)) {
    return res.status(400).json({
      error: 'Informe um estado válido: DISPONIVEL, EM_MANUTENCAO ou INDISPONIVEL.',
    });
  }

  try {
    const recurso = await prisma.recurso.findUnique({ where: { id } });

    if (!recurso) {
      return res.status(404).json({ error: 'Recurso não encontrado.' });
    }
    if (recurso.estado === 'EM_USO') {
      return res.status(409).json({
        error: 'O recurso está em uso. Registre a devolução antes de mudar o estado.',
      });
    }

    const atualizado = await prisma.recurso.update({
      where: { id },
      data: { estado: estado as EstadoManual },
    });
    const reservasAfetadas = estado === 'DISPONIVEL' ? [] : await buscarReservasFuturas(id);

    return res.json({ ...atualizado, reservasAfetadas });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao alterar o estado do recurso.' });
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
    apagarFoto(recurso.foto);
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao remover recurso.' });
  }
}

// Recebe a foto (campo multipart "foto") e substitui a anterior, se houver
export function atualizarFoto(req: ReqComId, res: Response) {
  uploadFoto(req, res, async (erro) => {
    if (erro instanceof multer.MulterError && erro.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'A foto deve ter no máximo 2 MB.' });
    }
    if (erro) {
      console.error(erro);
      return res.status(500).json({ error: 'Erro ao enviar a foto.' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Envie uma imagem JPG, PNG ou WebP.' });
    }

    const { id } = req.params;
    const novaFoto = caminhoPublico(req.file.filename);

    try {
      const existe = await prisma.recurso.findUnique({ where: { id } });

      if (!existe) {
        apagarFoto(novaFoto);
        return res.status(404).json({ error: 'Recurso não encontrado.' });
      }

      const recurso = await prisma.recurso.update({ where: { id }, data: { foto: novaFoto } });
      apagarFoto(existe.foto);
      return res.json(recurso);
    } catch (error) {
      console.error(error);
      apagarFoto(novaFoto);
      return res.status(500).json({ error: 'Erro ao salvar a foto.' });
    }
  });
}

// Remove a foto própria; o recurso volta a usar a capa padrão do tipo
export async function removerFoto(req: ReqComId, res: Response) {
  const { id } = req.params;

  try {
    const existe = await prisma.recurso.findUnique({ where: { id } });

    if (!existe) {
      return res.status(404).json({ error: 'Recurso não encontrado.' });
    }

    const recurso = await prisma.recurso.update({ where: { id }, data: { foto: null } });
    apagarFoto(existe.foto);
    return res.json(recurso);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao remover a foto.' });
  }
}
