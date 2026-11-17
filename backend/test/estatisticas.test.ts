import { beforeEach, describe, expect, it } from 'vitest';
import { api, criarRecurso, criarUsuario, limparBanco, prisma } from './helpers';
import { instanteNoFuso } from '../src/lib/fuso';

type Status = 'PENDENTE' | 'APROVADA' | 'RECUSADA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';

describe('estatísticas de uso', () => {
  beforeEach(limparBanco);

  // Semana de 05/10/2026 (segunda) a 09/10/2026 (sexta), 2 recursos e 2 turnos:
  // 5 dias x 2 turnos x 2 recursos = 20 períodos possíveis
  async function cenario() {
    const admin = await criarUsuario('ADMIN');
    const prof = await criarUsuario();
    const projetor = await criarRecurso({ nome: 'Projetor' });
    const sala = await criarRecurso({ nome: 'Sala 1', tipo: 'SALA' });
    await prisma.turno.create({ data: { nome: 'Manhã', horaInicio: '07:00', horaFim: '11:00', ordem: 1 } });
    await prisma.turno.create({ data: { nome: 'Tarde', horaInicio: '14:00', horaFim: '18:00', ordem: 2 } });

    const reserva = (
      recursoId: string,
      dia: string,
      inicio: string,
      fim: string,
      status: Status,
      extra: Record<string, unknown> = {}
    ) =>
      prisma.solicitacao.create({
        data: {
          usuarioId: prof.id,
          recursoId,
          status,
          dataInicio: instanteNoFuso(dia, inicio),
          dataFim: instanteNoFuso(dia, fim),
          ...extra,
        },
      });

    // Projetor: segunda de manhã (devolvido em dia), terça à tarde (devolvido
    // 2h atrasado e com defeito), quinta à tarde; sexta cancelada
    await reserva(projetor.id, '2026-10-05', '08:00', '10:00', 'CONCLUIDA', {
      retiradoEm: instanteNoFuso('2026-10-05', '08:00'),
      devolvidoEm: instanteNoFuso('2026-10-05', '10:00'),
      condicaoDevolucao: 'OK',
    });
    await reserva(projetor.id, '2026-10-06', '14:00', '18:00', 'CONCLUIDA', {
      retiradoEm: instanteNoFuso('2026-10-06', '14:00'),
      devolvidoEm: instanteNoFuso('2026-10-06', '20:00'),
      condicaoDevolucao: 'COM_DEFEITO',
    });
    await reserva(projetor.id, '2026-10-08', '14:00', '18:00', 'CONCLUIDA', {
      retiradoEm: instanteNoFuso('2026-10-08', '14:00'),
      devolvidoEm: instanteNoFuso('2026-10-08', '18:00'),
    });
    await reserva(projetor.id, '2026-10-09', '14:00', '18:00', 'CANCELADA');

    // Sala: quarta de manhã aprovada e nunca retirada; quinta recusada; sexta
    // de manhã uso institucional (ocupa, mas não é pedido de professor)
    await reserva(sala.id, '2026-10-07', '07:00', '11:00', 'APROVADA');
    await reserva(sala.id, '2026-10-08', '07:00', '11:00', 'RECUSADA');
    await reserva(sala.id, '2026-10-09', '07:00', '11:00', 'CONCLUIDA', {
      institucional: true,
      usuarioId: admin.id,
      devolvidoEm: instanteNoFuso('2026-10-09', '11:00'),
    });

    // Fora do período consultado
    await reserva(sala.id, '2026-10-12', '07:00', '11:00', 'CONCLUIDA');

    return { admin, prof };
  }

  it('calcula a ocupação por recurso, turno e dia da semana', async () => {
    const { admin } = await cenario();

    const res = await api()
      .get('/estatisticas?inicio=2026-10-05&fim=2026-10-09')
      .set('Authorization', admin.auth);

    expect(res.status).toBe(200);
    expect(res.body.periodo).toEqual({ inicio: '2026-10-05', fim: '2026-10-09', diasUteis: 5 });
    // 5 dos 20 períodos ocupados
    expect(res.body.ocupacao.taxa).toBe(25);
    expect(res.body.ocupacao.periodosOcupados).toBe(5);
    expect(res.body.ocupacao.periodosPossiveis).toBe(20);

    const porRecurso = Object.fromEntries(
      res.body.porRecurso.map((r: { nome: string; taxa: number; horasReservadas: number }) => [
        r.nome,
        [r.taxa, r.horasReservadas],
      ])
    );
    expect(porRecurso).toEqual({ Projetor: [30, 10], 'Sala 1': [20, 8] });
    // Mais ocupado primeiro
    expect(res.body.porRecurso[0].nome).toBe('Projetor');

    expect(res.body.porTurno.map((t: { nome: string; taxa: number }) => [t.nome, t.taxa])).toEqual([
      ['Manhã', 30],
      ['Tarde', 20],
    ]);
    expect(res.body.porDiaDaSemana.map((d: { dia: string; taxa: number }) => [d.dia, d.taxa])).toEqual([
      ['Seg', 25],
      ['Ter', 25],
      ['Qua', 25],
      ['Qui', 25],
      ['Sex', 25],
    ]);
  });

  it('resume os pedidos dos professores e as ocorrências do período', async () => {
    const { admin } = await cenario();

    const res = await api()
      .get('/estatisticas?inicio=2026-10-05&fim=2026-10-09')
      .set('Authorization', admin.auth);

    // O uso institucional não conta como pedido
    expect(res.body.pedidos).toEqual({
      total: 6,
      aprovados: 4,
      pendentes: 0,
      recusados: 1,
      cancelados: 1,
      taxaAprovacao: 80,
    });
    expect(res.body.pedidosPorSemana).toEqual([{ semana: '2026-10-05', total: 6 }]);
    expect(res.body.ocorrencias).toEqual({
      devolucoesAtrasadas: 1,
      devolucoesComProblema: 1,
      reservasNaoRetiradas: 1,
    });
  });

  it('usa os últimos 30 dias quando o período não é informado', async () => {
    const admin = await criarUsuario('ADMIN');

    const res = await api().get('/estatisticas').set('Authorization', admin.auth);

    expect(res.status).toBe(200);
    expect(res.body.ocupacao.taxa).toBe(0);
    const { inicio, fim } = res.body.periodo;
    const dias = (Date.parse(fim) - Date.parse(inicio)) / 86_400_000;
    expect(dias).toBe(29);
  });

  it('recusa períodos inválidos', async () => {
    const admin = await criarUsuario('ADMIN');
    const consultar = (q: string) => api().get(`/estatisticas?${q}`).set('Authorization', admin.auth);

    expect((await consultar('inicio=2026-10-09&fim=2026-10-05')).status).toBe(400);
    expect((await consultar('inicio=ontem&fim=2026-10-05')).status).toBe(400);
    expect((await consultar('inicio=2024-01-01&fim=2026-10-05')).status).toBe(400);
  });

  it('é restrito ao admin', async () => {
    const prof = await criarUsuario();

    const res = await api().get('/estatisticas').set('Authorization', prof.auth);

    expect(res.status).toBe(403);
  });
});
