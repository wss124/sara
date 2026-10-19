import { beforeEach, describe, expect, it } from 'vitest';
import { api, criarRecurso, criarUsuario, daqui, limparBanco, prisma } from './helpers';
import { dataNoFuso, instanteNoFuso, somarDias } from '../src/lib/fuso';
import { situacaoDoPeriodo } from '../src/lib/turnos';

const dia = () => dataNoFuso(daqui(72));

describe('disponibilidade por turno', () => {
  beforeEach(limparBanco);

  it('classifica o período: livre, parcial, ocupado por reservas emendadas e já começado', () => {
    const inicio = daqui(48);
    const fim = daqui(52);
    const reserva = (de: number, ate: number) => ({ dataInicio: daqui(de), dataFim: daqui(ate) });

    expect(situacaoDoPeriodo(inicio, fim, [reserva(40, 48)])).toBe('LIVRE');
    expect(situacaoDoPeriodo(inicio, fim, [reserva(49, 50)])).toBe('PARCIAL');
    expect(situacaoDoPeriodo(inicio, fim, [reserva(50, 53), reserva(47, 50)])).toBe('OCUPADO');
    expect(situacaoDoPeriodo(daqui(-1), fim, [])).toBe('ENCERRADO');
  });

  it('soma dias de calendário atravessando o mês', () => {
    expect(somarDias('2026-10-30', 3)).toBe('2026-11-02');
  });

  it('mostra cada turno do dia com ocupação e pedidos em análise', async () => {
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const [manha, tarde] = await Promise.all([
      prisma.turno.create({ data: { nome: 'Manhã', horaInicio: '07:00', horaFim: '11:00' } }),
      prisma.turno.create({ data: { nome: 'Tarde', horaInicio: '14:00', horaFim: '18:00' } }),
    ]);
    const reservar = (de: string, ate: string, status: 'APROVADA' | 'PENDENTE') =>
      prisma.solicitacao.create({
        data: {
          usuarioId: prof.id,
          recursoId: recurso.id,
          dataInicio: instanteNoFuso(dia(), de),
          dataFim: instanteNoFuso(dia(), ate),
          status,
        },
      });
    await reservar('15:00', '16:00', 'APROVADA');
    await reservar('08:00', '09:00', 'PENDENTE');

    const res = await api()
      .get(`/recursos/${recurso.id}/disponibilidade`)
      .query({ inicio: dia(), dias: 2 })
      .set('Authorization', prof.auth);

    expect(res.status).toBe(200);
    expect(res.body.turnos.map((t: { nome: string }) => t.nome)).toEqual(['Manhã', 'Tarde']);
    expect(res.body.dias.map((d: { data: string }) => d.data)).toEqual([dia(), somarDias(dia(), 1)]);
    const [hoje, amanha] = res.body.dias;
    expect(hoje.turnos).toEqual([
      { turnoId: manha.id, situacao: 'LIVRE', ocupados: [], pendentes: 1 },
      {
        turnoId: tarde.id,
        situacao: 'PARCIAL',
        ocupados: [
          {
            inicio: instanteNoFuso(dia(), '15:00').toISOString(),
            fim: instanteNoFuso(dia(), '16:00').toISOString(),
          },
        ],
        pendentes: 0,
      },
    ]);
    expect(amanha.turnos.every((t: { situacao: string }) => t.situacao === 'LIVRE')).toBe(true);
  });

  it('valida o período pedido', async () => {
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const consultar = (query: object) =>
      api().get(`/recursos/${recurso.id}/disponibilidade`).query(query).set('Authorization', prof.auth);

    expect((await consultar({ inicio: '19/10/2026' })).status).toBe(400);
    expect((await consultar({ dias: 15 })).status).toBe(400);
    expect((await consultar({})).status).toBe(200);
  });
});
