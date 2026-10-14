import jwt from 'jsonwebtoken';
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { JWT_SECRET } from '../src/lib/jwt';

export { prisma };
export const api = () => request(app);

// Apaga os dados entre os testes, respeitando as chaves estrangeiras
export async function limparBanco() {
  const tabelas = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
  );
  if (tabelas.length === 0) return;
  const lista = tabelas.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${lista} RESTART IDENTITY CASCADE`);
}

let contador = 0;

export async function criarUsuario(perfil: 'PROFESSOR' | 'ADMIN' = 'PROFESSOR') {
  contador += 1;
  const usuario = await prisma.usuario.create({
    data: {
      nome: `${perfil === 'ADMIN' ? 'Admin' : 'Professor'} ${contador}`,
      email: `usuario${contador}@prp.uespi.br`,
      senha: 'hash-irrelevante',
      perfil,
    },
  });
  const token = jwt.sign({ id: usuario.id, perfil: usuario.perfil }, JWT_SECRET);
  return { ...usuario, auth: `Bearer ${token}` };
}

export function criarRecurso(dados: Partial<{ nome: string; tipo: 'SALA' | 'EQUIPAMENTO' }> = {}) {
  contador += 1;
  return prisma.recurso.create({
    data: { nome: dados.nome ?? `Recurso ${contador}`, tipo: dados.tipo ?? 'EQUIPAMENTO' },
  });
}

// Data relativa a agora, em horas (ex.: daqui(48) = depois de amanhã)
export function daqui(horas: number) {
  return new Date(Date.now() + horas * 60 * 60 * 1000);
}
