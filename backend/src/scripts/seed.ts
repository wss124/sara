// Popula o banco com dados de demonstração: um admin, um professor, uma aluna,
// cinco recursos e reservas em torno do horário atual. Pode ser executado de
// novo antes de uma apresentação: as reservas dos usuários demo são recriadas
// para que o dashboard sempre mostre um recurso "em uso agora".
// Os demais usuários e solicitações do banco não são alterados.
//   npm run seed
import '../env';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma';

const SENHA_DEMO = '123456';

const USUARIOS = [
  { nome: 'Administrador SARA', email: 'admin@prp.uespi.br', perfil: 'ADMIN' },
  { nome: 'Carlos Lima', email: 'professor@prp.uespi.br', perfil: 'PROFESSOR' },
  { nome: 'Ana Souza', email: 'aluna@aluno.uespi.br', perfil: 'ALUNO' },
] as const;

const RECURSOS = [
  { nome: 'Laboratório de Informática 1', tipo: 'SALA', descricao: '30 computadores, quadro branco' },
  { nome: 'Sala 204', tipo: 'SALA', descricao: 'Capacidade para 40 alunos' },
  { nome: 'Auditório', tipo: 'SALA', descricao: 'Capacidade para 120 pessoas, som e telão' },
  { nome: 'Projetor Epson', tipo: 'EQUIPAMENTO', descricao: 'Datashow com cabo HDMI' },
  { nome: 'Notebook Dell', tipo: 'EQUIPAMENTO', descricao: 'Para apresentações' },
] as const;

// Horário cheio relativo a agora (ex.: horas(-1) = uma hora atrás, arredondado)
function horas(deslocamento: number) {
  const data = new Date();
  data.setMinutes(0, 0, 0);
  data.setHours(data.getHours() + deslocamento);
  return data;
}

// Amanhã no horário indicado
function amanha(hora: number) {
  const data = new Date();
  data.setDate(data.getDate() + 1);
  data.setHours(hora, 0, 0, 0);
  return data;
}

async function main() {
  const senha = await bcrypt.hash(SENHA_DEMO, 10);

  const [admin, professor, aluna] = await Promise.all(
    USUARIOS.map((u) =>
      prisma.usuario.upsert({
        where: { email: u.email },
        update: { perfil: u.perfil },
        create: { ...u, senha },
      })
    )
  );

  const recursos: Record<string, string> = {};
  for (const r of RECURSOS) {
    const existente = await prisma.recurso.findFirst({ where: { nome: r.nome } });
    const recurso = existente ?? (await prisma.recurso.create({ data: r }));
    recursos[r.nome] = recurso.id;
  }

  await prisma.solicitacao.deleteMany({
    where: { usuarioId: { in: [admin!.id, professor!.id, aluna!.id] } },
  });

  await prisma.solicitacao.createMany({
    data: [
      {
        // Em uso agora: aparece como ocupado no dashboard
        usuarioId: professor!.id,
        recursoId: recursos['Laboratório de Informática 1']!,
        dataInicio: horas(-1),
        dataFim: horas(1),
        status: 'APROVADA',
        aprovadoPorId: admin!.id,
        observacao: 'Aula prática de Banco de Dados',
      },
      {
        usuarioId: aluna!.id,
        recursoId: recursos['Projetor Epson']!,
        dataInicio: horas(2),
        dataFim: horas(4),
        status: 'APROVADA',
        aprovadoPorId: admin!.id,
        observacao: 'Ensaio da apresentação do seminário',
      },
      {
        usuarioId: aluna!.id,
        recursoId: recursos['Sala 204']!,
        dataInicio: amanha(14),
        dataFim: amanha(16),
        status: 'PENDENTE',
        observacao: 'Grupo de estudos para a prova',
      },
      {
        usuarioId: professor!.id,
        recursoId: recursos['Laboratório de Informática 1']!,
        dataInicio: amanha(8),
        dataFim: amanha(10),
        status: 'PENDENTE',
        observacao: 'Aula de reposição',
      },
      {
        usuarioId: aluna!.id,
        recursoId: recursos['Auditório']!,
        dataInicio: amanha(9),
        dataFim: amanha(11),
        status: 'RECUSADA',
        aprovadoPorId: admin!.id,
        observacao: 'Ensaio do centro acadêmico',
      },
    ],
  });

  console.log('Dados de demonstração prontos. Senha de todos os usuários demo:', SENHA_DEMO);
  for (const u of USUARIOS) console.log(`  ${u.perfil.padEnd(9)} ${u.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
