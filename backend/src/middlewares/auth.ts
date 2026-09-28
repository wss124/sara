import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../lib/jwt';

interface UsuarioToken {
  id: string;
  perfil: 'ALUNO' | 'PROFESSOR' | 'ADMIN';
}

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioToken;
    }
  }
}

export function autenticar(req: Request, res: Response, next: NextFunction) {
  const [tipo, token] = req.headers.authorization?.split(' ') ?? [];

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token não informado.' });
  }

  try {
    req.usuario = jwt.verify(token, JWT_SECRET) as UsuarioToken;
    return next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}

export function somenteAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.usuario?.perfil !== 'ADMIN') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }

  return next();
}
