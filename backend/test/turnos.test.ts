import { beforeEach, describe, expect, it } from 'vitest';
import { api, criarUsuario, limparBanco, prisma } from './helpers';
import { periodoDoTurno, turnosSeSobrepoem } from '../src/lib/turnos';

describe('turnos', () => {
  beforeEach(limparBanco);

  it('converte turno + data em período no fuso do campus', () => {
    const { inicio, fim } = periodoDoTurno('2026-10-14', { horaInicio: '13:30', horaFim: '18:00' });
    expect(inicio.toISOString()).toBe('2026-10-14T16:30:00.000Z');
    expect(fim.toISOString()).toBe('2026-10-14T21:00:00.000Z');
  });

  it('turnos encostados não se sobrepõem', () => {
    const manha = { horaInicio: '07:30', horaFim: '12:00' };
    expect(turnosSeSobrepoem(manha, { horaInicio: '12:00', horaFim: '13:00' })).toBe(false);
    expect(turnosSeSobrepoem(manha, { horaInicio: '11:30', horaFim: '13:00' })).toBe(true);
  });

  it('admin cadastra e edita os horários', async () => {
    const admin = await criarUsuario('ADMIN');

    const criado = await api()
      .post('/turnos')
      .set('Authorization', admin.auth)
      .send({ nome: 'Tarde', horaInicio: '13:30', horaFim: '18:00', ordem: 2 });
    const editado = await api()
      .put(`/turnos/${criado.body.id}`)
      .set('Authorization', admin.auth)
      .send({ horaInicio: '14:00' });

    expect(criado.status).toBe(201);
    expect(editado.body).toMatchObject({ nome: 'Tarde', horaInicio: '14:00', horaFim: '18:00' });
  });

  it('rejeita horário inválido, invertido ou sobreposto', async () => {
    const admin = await criarUsuario('ADMIN');
    await prisma.turno.create({ data: { nome: 'Manhã', horaInicio: '07:30', horaFim: '12:00' } });
    const enviar = (corpo: object) => api().post('/turnos').set('Authorization', admin.auth).send(corpo);

    expect((await enviar({ nome: 'X', horaInicio: '7h', horaFim: '12:00' })).status).toBe(400);
    expect((await enviar({ nome: 'X', horaInicio: '15:00', horaFim: '14:00' })).status).toBe(400);
    const sobreposto = await enviar({ nome: 'X', horaInicio: '11:00', horaFim: '13:00' });
    expect(sobreposto.status).toBe(400);
    expect(sobreposto.body.error).toContain('Manhã');
  });

  it('professor vê só os turnos ativos e não altera', async () => {
    const prof = await criarUsuario();
    await prisma.turno.createMany({
      data: [
        { nome: 'Manhã', horaInicio: '07:30', horaFim: '12:00', ordem: 1 },
        { nome: 'Antigo', horaInicio: '12:00', horaFim: '13:00', ativo: false },
      ],
    });

    const lista = await api().get('/turnos').set('Authorization', prof.auth);
    const criar = await api()
      .post('/turnos')
      .set('Authorization', prof.auth)
      .send({ nome: 'X', horaInicio: '13:00', horaFim: '14:00' });

    expect(lista.body.map((t: { nome: string }) => t.nome)).toEqual(['Manhã']);
    expect(criar.status).toBe(403);
  });
});
