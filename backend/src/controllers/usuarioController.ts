import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

type ReqComId = Request<{ id: string }>;

const PERFIS_VALIDOS = ['ALUNO', 'PROFESSOR', 'ADMIN'];

const camposPublicos = {
  id: true,
  nome: true,
  email: true,
  perfil: true,
  criadoEm: true,
} as const;

// Admin: lista os usuários (sem a senha), com filtro opcional por perfil
export async function listar(req: Request, res: Response) {
  const { perfil } = req.query;

  if (perfil && !PERFIS_VALIDOS.includes(String(perfil))) {
    return res.status(400).json({ error: 'Perfil inválido.' });
  }

  try {
    const usuarios = await prisma.usuario.findMany({
      where: perfil ? { perfil: perfil as 'ALUNO' | 'PROFESSOR' | 'ADMIN' } : {},
      select: camposPublicos,
      orderBy: { nome: 'asc' },
    });

    return res.json(usuarios);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao listar usuários.' });
  }
}

// Admin: promove ou rebaixa um usuário. O novo perfil vale a partir do
// próximo login, porque o perfil atual viaja dentro do token JWT.
export async function alterarPerfil(req: ReqComId, res: Response) {
  const { id } = req.params;
  const { perfil } = req.body;

  if (!PERFIS_VALIDOS.includes(String(perfil))) {
    return res.status(400).json({ error: 'Informe um perfil válido: ALUNO, PROFESSOR ou ADMIN.' });
  }

  // Impede que o admin tire o próprio acesso e deixe o sistema sem administrador
  if (id === req.usuario!.id) {
    return res.status(409).json({ error: 'Você não pode alterar o seu próprio perfil.' });
  }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { id } });

    if (!usuario) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const atualizado = await prisma.usuario.update({
      where: { id },
      data: { perfil: perfil as 'ALUNO' | 'PROFESSOR' | 'ADMIN' },
      select: camposPublicos,
    });

    return res.json(atualizado);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao alterar perfil.' });
  }
}
