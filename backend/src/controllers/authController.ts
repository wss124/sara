import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { JWT_SECRET } from '../lib/jwt';
import { DOMINIOS_PERMITIDOS, emailInstitucional } from '../lib/dominios';

export async function register(req: Request, res: Response) {
  // O perfil não vem do corpo: todo cadastro público nasce como ALUNO e só
  // um administrador pode promover a conta (rota /usuarios/:id/perfil).
  const { nome, senha } = req.body;
  const email = String(req.body.email ?? '').trim().toLowerCase();

  if (!nome?.trim() || !email || !senha) {
    return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
  }
  if (!emailInstitucional(email)) {
    return res.status(400).json({
      error: `Use seu e-mail institucional (${DOMINIOS_PERMITIDOS.map((d) => '@' + d).join(' ou ')}).`,
    });
  }
  if (String(senha).length < 6) {
    return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
  }

  try {
    const usuarioExistente = await prisma.usuario.findUnique({ where: { email } });

    if (usuarioExistente) {
      return res.status(409).json({ error: 'Já existe um usuário com esse e-mail.' });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nome: nome.trim(),
        email,
        senha: senhaHash,
      },
    });

    return res.status(201).json({
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
}

export async function login(req: Request, res: Response) {
  const { senha } = req.body;
  const email = String(req.body.email ?? '').trim().toLowerCase();

  if (!email || !senha) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const usuario = await prisma.usuario.findUnique({ where: { email } });

    if (!usuario) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);

    if (!senhaValida) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    }

    const token = jwt.sign(
      { id: usuario.id, perfil: usuario.perfil },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        perfil: usuario.perfil,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao autenticar.' });
  }
}