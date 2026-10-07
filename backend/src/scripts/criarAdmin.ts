// Cria (ou promove) o primeiro administrador do sistema, já que o cadastro
// público só gera contas de ALUNO. Uso:
//   npm run criar-admin -- "Nome do Admin" admin@uespi.br senha123
import '../env';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';

async function main() {
  const [nome, email, senha] = process.argv.slice(2);

  if (!nome || !email || !senha) {
    console.error('Uso: npm run criar-admin -- "Nome" email senha');
    process.exitCode = 1;
    return;
  }

  const existente = await prisma.usuario.findUnique({ where: { email } });

  if (existente) {
    await prisma.usuario.update({ where: { email }, data: { perfil: 'ADMIN' } });
    console.log(`Usuário ${email} promovido a ADMIN.`);
    return;
  }

  await prisma.usuario.create({
    data: { nome, email, senha: await bcrypt.hash(senha, 10), perfil: 'ADMIN' },
  });
  console.log(`Administrador ${email} criado.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
