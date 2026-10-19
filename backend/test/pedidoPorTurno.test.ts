import { beforeEach, describe, expect, it } from 'vitest';
import { api, criarRecurso, criarUsuario, daqui, limparBanco, prisma } from './helpers';
import { dataNoFuso, instanteNoFuso } from '../src/lib/fuso';

// Daqui a três dias, no fuso do campus
const dia = () => dataNoFuso(daqui(72));

async function criarTurnos() {
  const [manha, tarde] = await Promise.all([
    prisma.turno.create({ data: { nome: 'Manhã', horaInicio: '07:30', horaFim: '12:00', ordem: 1 } }),
    prisma.turno.create({ data: { nome: 'Tarde', horaInicio: '13:30', horaFim: '18:00', ordem: 2 } }),
  ]);
  return { manha, tarde };
}

describe('pedido por turno', () => {
  beforeEach(limparBanco);

  it('professor reserva a tarde inteira com uma seleção', async () => {
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const { tarde } = await criarTurnos();

    const res = await api()
      .post('/solicitacoes')
      .set('Authorization', prof.auth)
      .send({ recursoId: recurso.id, data: dia(), turnoIds: [tarde.id] });

    expect(res.status).toBe(201);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      status: 'PENDENTE',
      turno: { id: tarde.id, nome: 'Tarde' },
      dataInicio: instanteNoFuso(dia(), '13:30').toISOString(),
      dataFim: instanteNoFuso(dia(), '18:00').toISOString(),
    });
  });

  it('manhã + tarde viram dois pedidos separados', async () => {
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const { manha, tarde } = await criarTurnos();

    const res = await api()
      .post('/solicitacoes')
      .set('Authorization', prof.auth)
      .send({ recursoId: recurso.id, data: dia(), turnoIds: [tarde.id, manha.id] });

    expect(res.status).toBe(201);
    expect(res.body.map((s: { turno: { nome: string } }) => s.turno.nome)).toEqual(['Manhã', 'Tarde']);
  });

  it('turno com qualquer conflito não é reservado, e nenhum pedido é criado', async () => {
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const { manha, tarde } = await criarTurnos();
    await prisma.solicitacao.create({
      data: {
        usuarioId: prof.id,
        recursoId: recurso.id,
        dataInicio: instanteNoFuso(dia(), '15:00'),
        dataFim: instanteNoFuso(dia(), '16:00'),
        status: 'APROVADA',
      },
    });

    const res = await api()
      .post('/solicitacoes')
      .set('Authorization', prof.auth)
      .send({ recursoId: recurso.id, data: dia(), turnoIds: [manha.id, tarde.id] });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/^Tarde: /);
    expect(await prisma.solicitacao.count({ where: { status: 'PENDENTE' } })).toBe(0);
  });

  it('rejeita turno desativado, repetido ou data inválida', async () => {
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const { tarde } = await criarTurnos();
    const inativo = await prisma.turno.create({
      data: { nome: 'Noite', horaInicio: '18:30', horaFim: '22:00', ativo: false },
    });
    const enviar = (corpo: object) =>
      api().post('/solicitacoes').set('Authorization', prof.auth).send({ recursoId: recurso.id, ...corpo });

    expect((await enviar({ data: dia(), turnoIds: [inativo.id] })).status).toBe(400);
    expect((await enviar({ data: dia(), turnoIds: [tarde.id, tarde.id] })).status).toBe(400);
    expect((await enviar({ data: dia(), turnoIds: [] })).status).toBe(400);
    expect((await enviar({ data: '14/10/2026', turnoIds: [tarde.id] })).status).toBe(400);
  });

  it('admin lança reserva por turno, já aprovada', async () => {
    const admin = await criarUsuario('ADMIN');
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const { manha } = await criarTurnos();

    const res = await api()
      .post('/solicitacoes/reservas')
      .set('Authorization', admin.auth)
      .send({ recursoId: recurso.id, usuarioId: prof.id, data: dia(), turnoIds: [manha.id] });

    expect(res.status).toBe(201);
    expect(res.body[0]).toMatchObject({ status: 'APROVADA', turnoId: manha.id, pendentesConflitantes: 0 });
  });

  it('excluir o turno mantém o período das reservas já feitas', async () => {
    const admin = await criarUsuario('ADMIN');
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const { tarde } = await criarTurnos();
    const [pedido] = (
      await api()
        .post('/solicitacoes')
        .set('Authorization', prof.auth)
        .send({ recursoId: recurso.id, data: dia(), turnoIds: [tarde.id] })
    ).body;

    await api().delete(`/turnos/${tarde.id}`).set('Authorization', admin.auth);
    const depois = await prisma.solicitacao.findUniqueOrThrow({ where: { id: pedido.id } });

    expect(depois.turnoId).toBeNull();
    expect(depois.dataInicio.toISOString()).toBe(pedido.dataInicio);
  });
});
