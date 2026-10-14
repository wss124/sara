// Popula o banco com dados de demonstração: um admin, dois professores,
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
  { nome: 'Ana Souza', email: 'professora@prp.uespi.br', perfil: 'PROFESSOR' },
] as const;

const RECURSOS = [
  { nome: 'Laboratório de Informática 1', tipo: 'SALA', descricao: '30 computadores, quadro branco', localizacao: 'Bloco A, térreo', estado: 'DISPONIVEL' },
  { nome: 'Sala 204', tipo: 'SALA', descricao: 'Capacidade para 40 alunos', localizacao: 'Bloco B, 2º andar', estado: 'DISPONIVEL' },
  { nome: 'Auditório', tipo: 'SALA', descricao: 'Capacidade para 120 pessoas, som e telão', localizacao: 'Prédio central', estado: 'DISPONIVEL' },
  { nome: 'Projetor Epson', tipo: 'EQUIPAMENTO', descricao: 'Datashow com cabo HDMI', localizacao: 'Coordenação do curso', estado: 'DISPONIVEL' },
  // Em manutenção, para demonstrar o bloqueio de novos pedidos
  { nome: 'Notebook Dell', tipo: 'EQUIPAMENTO', descricao: 'Para apresentações', localizacao: 'Coordenação do curso', estado: 'EM_MANUTENCAO' },
] as const;

const ACESSORIOS = [
  { nome: 'Extensão 5 m', quantidade: 2, localizacao: 'Dispensa do Bloco B' },
  { nome: 'Cabo HDMI', quantidade: 3, localizacao: 'Coordenação do curso' },
  { nome: 'Controle remoto do projetor', quantidade: 1, localizacao: 'Coordenação do curso' },
  { nome: 'Apontador laser', quantidade: 1, localizacao: 'Coordenação do curso' },
  { nome: 'Carregador do notebook', quantidade: 1, localizacao: 'Coordenação do curso' },
] as const;

// O que acompanha cada recurso: [acessório, obrigatório]
const KITS: Record<string, [string, boolean][]> = {
  'Projetor Epson': [
    ['Extensão 5 m', true],
    ['Cabo HDMI', true],
    ['Controle remoto do projetor', true],
    ['Apontador laser', false],
  ],
  'Notebook Dell': [
    ['Carregador do notebook', true],
    ['Cabo HDMI', false],
  ],
};

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

  const [admin, professor, professora] = await Promise.all(
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
    const recurso = existente
      ? await prisma.recurso.update({
          where: { id: existente.id },
          data: { estado: r.estado, localizacao: r.localizacao },
        })
      : await prisma.recurso.create({ data: r });
    recursos[r.nome] = recurso.id;
  }

  const acessorios: Record<string, string> = {};
  for (const a of ACESSORIOS) {
    const existente = await prisma.acessorio.findFirst({ where: { nome: a.nome } });
    const acessorio = existente ?? (await prisma.acessorio.create({ data: a }));
    acessorios[a.nome] = acessorio.id;
  }
  for (const [recurso, itens] of Object.entries(KITS)) {
    await prisma.recursoAcessorio.deleteMany({ where: { recursoId: recursos[recurso]! } });
    await prisma.recursoAcessorio.createMany({
      data: itens.map(([nome, obrigatorio]) => ({
        recursoId: recursos[recurso]!,
        acessorioId: acessorios[nome]!,
        obrigatorio,
      })),
    });
  }

  await prisma.solicitacao.deleteMany({
    where: { usuarioId: { in: [admin!.id, professor!.id, professora!.id] } },
  });

  await prisma.solicitacao.createMany({
    data: [
      {
        // Em uso agora: já retirado no balcão, aparece como ocupado no dashboard
        usuarioId: professor!.id,
        recursoId: recursos['Laboratório de Informática 1']!,
        dataInicio: horas(-1),
        dataFim: horas(1),
        status: 'EM_ANDAMENTO',
        aprovadoPorId: admin!.id,
        retiradoEm: horas(-1),
        retiradaRegistradaPorId: admin!.id,
        observacao: 'Aula prática de Banco de Dados',
      },
      {
        usuarioId: professora!.id,
        recursoId: recursos['Projetor Epson']!,
        dataInicio: horas(2),
        dataFim: horas(4),
        status: 'APROVADA',
        aprovadoPorId: admin!.id,
        observacao: 'Apresentação de seminários da turma',
      },
      {
        usuarioId: professora!.id,
        recursoId: recursos['Sala 204']!,
        dataInicio: amanha(14),
        dataFim: amanha(16),
        status: 'PENDENTE',
        observacao: 'Aula de revisão para a prova',
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
        usuarioId: professora!.id,
        recursoId: recursos['Auditório']!,
        dataInicio: amanha(9),
        dataFim: amanha(11),
        status: 'RECUSADA',
        aprovadoPorId: admin!.id,
        observacao: 'Palestra da semana acadêmica',
      },
    ],
  });
  await prisma.recurso.update({
    where: { id: recursos['Laboratório de Informática 1']! },
    data: { estado: 'EM_USO' },
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
