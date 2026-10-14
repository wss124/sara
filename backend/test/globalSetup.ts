import { execSync } from 'child_process';
import { PrismaClient } from '../src/generated/prisma/client';
import { urlBancoDeTeste } from './bancoDeTeste';

// Prepara o banco de teste (sara_test) antes da suíte: cria se não existir,
// zera o schema e aplica todas as migrations. O banco de desenvolvimento
// nunca é tocado pelos testes.
export default async function setup() {
  const url = new URL(urlBancoDeTeste());
  const nomeBanco = url.pathname.slice(1);
  if (!nomeBanco.endsWith('_test')) {
    throw new Error(`Banco de teste deve terminar em _test (recebido: ${nomeBanco}).`);
  }

  const servidor = new URL(url);
  servidor.pathname = '/postgres';
  const admin = new PrismaClient({ datasourceUrl: servidor.toString() });
  const existe = await admin.$queryRawUnsafe<unknown[]>(
    `SELECT 1 FROM pg_database WHERE datname = '${nomeBanco}'`
  );
  if (existe.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE "${nomeBanco}"`);
  await admin.$disconnect();

  const banco = new PrismaClient({ datasourceUrl: url.toString() });
  await banco.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
  await banco.$executeRawUnsafe('CREATE SCHEMA public');
  await banco.$disconnect();

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: 'ignore',
  });
}
