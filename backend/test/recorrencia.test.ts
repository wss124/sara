import { beforeEach, describe, expect, it } from 'vitest';
import { api, criarRecurso, criarUsuario, daqui, limparBanco, prisma } from './helpers';
import { dataNoFuso, instanteNoFuso, somarDias } from '../src/lib/fuso';
import { descreverDias, diaDaSemana, gerarDatas, validarSerie } from '../src/lib/recorrencia';

// Série de quatro semanas começando daqui a três dias, no mesmo dia da semana
const primeiro = () => dataNoFuso(daqui(72));
const ultimo = () => somarDias(primeiro(), 21);
const semanas = () => [0, 7, 14, 21].map((n) => somarDias(primeiro(), n));

async function preparar() {
  const prof = await criarUsuario();
  const recurso = await criarRecurso();
  const tarde = await prisma.turno.create({
    data: { nome: 'Tarde', horaInicio: '14:00', horaFim: '18:00' },
  });
  const serie = {
    recursoId: recurso.id,
    turnoId: tarde.id,
    diasSemana: [diaDaSemana(primeiro())],
    dataInicio: primeiro(),
    dataFim: ultimo(),
  };
  return { prof, recurso, tarde, serie };
}

function reservaAprovada(usuarioId: string, recursoId: string, dia: string, status: 'APROVADA' | 'PENDENTE' = 'APROVADA') {
  return prisma.solicitacao.create({
    data: {
      usuarioId,
      recursoId,
      dataInicio: instanteNoFuso(dia, '15:00'),
      dataFim: instanteNoFuso(dia, '16:00'),
      status,
    },
  });
}

describe('geração das datas da série', () => {
  it('inclui o primeiro e o último dia quando caem no dia escolhido', () => {
    // 20/10/2026 é terça (2); 17/11 também
    expect(gerarDatas('2026-10-20', '2026-11-17', [2])).toEqual([
      '2026-10-20',
      '2026-10-27',
      '2026-11-03',
      '2026-11-10',
      '2026-11-17',
    ]);
  });

  it('combina vários dias da semana e atravessa o mês', () => {
    expect(gerarDatas('2026-10-29', '2026-11-03', [2, 4])).toEqual(['2026-10-29', '2026-11-03']);
  });

  it('respeita o limite de um semestre e exige dias e horário válidos', () => {
    const base = { diasSemana: [2], dataInicio: '2026-10-20', horaInicio: '14:00', horaFim: '18:00' };
    // 20/10/2026 + 183 dias = 21/04/2027
    expect(validarSerie({ ...base, dataFim: '2027-04-21' })).toBeNull();
    expect(validarSerie({ ...base, dataFim: '2027-04-22' })).toMatch(/183 dias/);
    expect(validarSerie({ ...base, dataFim: '2026-10-19' })).toMatch(/depois do primeiro/);
    expect(validarSerie({ ...base, dataFim: '2026-10-26', diasSemana: [] })).toMatch(/dias da semana/);
    expect(validarSerie({ ...base, dataFim: '2026-10-26', diasSemana: [7] })).toMatch(/dias da semana/);
    expect(validarSerie({ ...base, dataFim: '2026-10-21', diasSemana: [5] })).toMatch(/Nenhuma data/);
    expect(validarSerie({ ...base, dataFim: '2026-10-26', horaFim: '13:00' })).toMatch(/fim/);
  });

  it('descreve os dias em português', () => {
    expect(descreverDias([2])).toBe('toda terça');
    expect(descreverDias([6])).toBe('todo sábado');
    expect(descreverDias([4, 0, 2])).toBe('toda semana (terça, quinta e domingo)');
  });
});

describe('séries semanais', () => {
  beforeEach(limparBanco);

  it('prévia aponta as datas com conflito antes de enviar', async () => {
    const { prof, recurso, serie } = await preparar();
    await reservaAprovada(prof.id, recurso.id, semanas()[1]!);

    const res = await api().post('/recorrencias/previa').set('Authorization', prof.auth).send(serie);

    expect(res.status).toBe(200);
    expect(res.body.datas.map((d: { data: string; ok: boolean }) => [d.data, d.ok])).toEqual([
      [semanas()[0], true],
      [semanas()[1], false],
      [semanas()[2], true],
      [semanas()[3], true],
    ]);
    expect(res.body.datas[1].motivo).toMatch(/já está reservado/);
  });

  it('cria um pedido por data livre, pulando conflitos e datas desmarcadas', async () => {
    const { prof, recurso, tarde, serie } = await preparar();
    await reservaAprovada(prof.id, recurso.id, semanas()[1]!);

    const res = await api()
      .post('/recorrencias')
      .set('Authorization', prof.auth)
      .send({ ...serie, ignorarDatas: [semanas()[2]] });

    expect(res.status).toBe(201);
    expect(res.body.criadas).toBe(2);
    expect(res.body.puladas).toEqual([{ data: semanas()[1], motivo: expect.stringMatching(/reservado/) }]);
    const pedidos = await prisma.solicitacao.findMany({
      where: { recorrenciaId: res.body.recorrencia.id },
      orderBy: { dataInicio: 'asc' },
    });
    expect(pedidos.map((p) => p.dataInicio.toISOString())).toEqual([
      instanteNoFuso(semanas()[0]!, '14:00').toISOString(),
      instanteNoFuso(semanas()[3]!, '14:00').toISOString(),
    ]);
    expect(pedidos.every((p) => p.status === 'PENDENTE' && p.turnoId === tarde.id)).toBe(true);
  });

  it('recusa criar quando nenhuma data está livre e não deixa o admin criar série', async () => {
    const { prof, recurso, serie } = await preparar();
    const admin = await criarUsuario('ADMIN');
    for (const dia of semanas()) await reservaAprovada(prof.id, recurso.id, dia);

    const semVaga = await api().post('/recorrencias').set('Authorization', prof.auth).send(serie);
    const peloAdmin = await api().post('/recorrencias').set('Authorization', admin.auth).send(serie);

    expect(semVaga.status).toBe(409);
    expect(peloAdmin.status).toBe(403);
    expect(await prisma.recorrencia.count()).toBe(0);
  });

  it('admin aprova a série em lote; datas que colidem ficam pendentes e são informadas', async () => {
    const { prof, recurso, serie } = await preparar();
    const admin = await criarUsuario('ADMIN');
    const outro = await criarUsuario();
    const criada = await api().post('/recorrencias').set('Authorization', prof.auth).send(serie);
    // Depois do pedido, outra reserva foi aprovada na 3ª semana, e outro
    // professor pediu a 1ª semana
    await reservaAprovada(outro.id, recurso.id, semanas()[2]!);
    const concorrente = await reservaAprovada(outro.id, recurso.id, semanas()[0]!, 'PENDENTE');

    const res = await api()
      .patch(`/recorrencias/${criada.body.recorrencia.id}/aprovar`)
      .set('Authorization', admin.auth);

    expect(res.status).toBe(200);
    expect(res.body.aprovadas).toBe(3);
    expect(res.body.falhas).toEqual([{ data: semanas()[2], motivo: expect.stringMatching(/aprovada/) }]);
    expect(res.body.semVaga.map((s: { id: string }) => s.id)).toEqual([concorrente.id]);
    const status = await prisma.solicitacao.groupBy({
      by: ['status'],
      where: { recorrenciaId: criada.body.recorrencia.id },
      _count: { _all: true },
    });
    expect(Object.fromEntries(status.map((s) => [s.status, s._count._all]))).toEqual({
      APROVADA: 3,
      PENDENTE: 1,
    });
  });

  it('admin recusa as datas pendentes da série com motivo', async () => {
    const { prof, serie } = await preparar();
    const admin = await criarUsuario('ADMIN');
    const criada = await api().post('/recorrencias').set('Authorization', prof.auth).send(serie);

    const res = await api()
      .patch(`/recorrencias/${criada.body.recorrencia.id}/recusar`)
      .set('Authorization', admin.auth)
      .send({ motivo: 'Laboratório reservado para a semana de provas.' });

    expect(res.body).toEqual({ recusadas: 4 });
    expect(
      await prisma.solicitacao.count({
        where: { status: 'RECUSADA', motivoRecusa: 'Laboratório reservado para a semana de provas.' },
      })
    ).toBe(4);
  });

  it('professor cancela a série: pendentes somem, aprovadas futuras são canceladas', async () => {
    const { prof, serie } = await preparar();
    const admin = await criarUsuario('ADMIN');
    const outro = await criarUsuario();
    const criada = await api().post('/recorrencias').set('Authorization', prof.auth).send(serie);
    const id = criada.body.recorrencia.id;
    const [primeira] = await prisma.solicitacao.findMany({
      where: { recorrenciaId: id },
      orderBy: { dataInicio: 'asc' },
    });
    await api().patch(`/solicitacoes/${primeira!.id}/aprovar`).set('Authorization', admin.auth);

    const deOutro = await api().delete(`/recorrencias/${id}`).set('Authorization', outro.auth);
    const res = await api().delete(`/recorrencias/${id}`).set('Authorization', prof.auth);

    expect(deOutro.status).toBe(404);
    expect(res.body).toEqual({ removidas: 3, canceladas: 1 });
    expect((await prisma.solicitacao.findUniqueOrThrow({ where: { id: primeira!.id } })).status).toBe(
      'CANCELADA'
    );
  });

  it('os pedidos da série trazem os dados da série na listagem', async () => {
    const { prof, serie } = await preparar();
    await api().post('/recorrencias').set('Authorization', prof.auth).send(serie);

    const res = await api().get('/solicitacoes/minhas').set('Authorization', prof.auth);

    expect(res.body[0].recorrencia).toMatchObject({
      diasSemana: serie.diasSemana,
      dataInicio: primeiro(),
      dataFim: ultimo(),
      horaInicio: '14:00',
    });
  });
});
