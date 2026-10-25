import { beforeEach, describe, expect, it } from 'vitest';
import { api, criarRecurso, criarUsuario, daqui, limparBanco, prisma } from './helpers';
import { conferirAntecedencia, validarRegras } from '../src/lib/configuracao';
import { dataNoFuso, instanteNoFuso, somarDias } from '../src/lib/fuso';
import { diaDaSemana } from '../src/lib/recorrencia';

const regras = { antecedenciaMinHoras: 24, antecedenciaMaxDias: 30 };

function salvarRegras(r = regras) {
  return prisma.configuracao.create({ data: { id: 'padrao', ...r } });
}

describe('regras de antecedência', () => {
  beforeEach(limparBanco);

  it('exige o mínimo em horas e limita o máximo por dia de calendário', () => {
    // 25/10/2026 10:00 no campus
    const agora = instanteNoFuso('2026-10-25', '10:00');
    const conferir = (dia: string, hora: string) =>
      conferirAntecedencia(instanteNoFuso(dia, hora), regras, { agora });

    expect(conferir('2026-10-26', '09:59')).toMatch(/24 horas/);
    expect(conferir('2026-10-26', '10:00')).toBeNull();
    // 25/10 + 30 dias = 24/11: vale o dia todo, até a noite
    expect(conferir('2026-11-24', '21:00')).toBeNull();
    expect(conferir('2026-11-25', '07:00')).toMatch(/30 dias/);
  });

  it('valida os valores editados pelo admin', () => {
    expect(validarRegras(regras)).toBeNull();
    expect(validarRegras({ antecedenciaMinHoras: -1, antecedenciaMaxDias: 30 })).toMatch(/mínima/);
    expect(validarRegras({ antecedenciaMinHoras: 2.5, antecedenciaMaxDias: 30 })).toMatch(/mínima/);
    expect(validarRegras({ antecedenciaMinHoras: 24, antecedenciaMaxDias: 0 })).toMatch(/máxima/);
    expect(validarRegras({ antecedenciaMinHoras: 48, antecedenciaMaxDias: 2 })).toMatch(/menor que a máxima/);
  });

  it('professor não pede em cima da hora nem longe demais', async () => {
    await salvarRegras();
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const pedir = (inicio: Date, fim: Date) =>
      api()
        .post('/solicitacoes')
        .set('Authorization', prof.auth)
        .send({ recursoId: recurso.id, dataInicio: inicio, dataFim: fim });

    const cedo = await pedir(daqui(2), daqui(4));
    const longe = await pedir(daqui(24 * 40), daqui(24 * 40 + 2));
    const ok = await pedir(daqui(48), daqui(50));

    expect(cedo.status).toBe(400);
    expect(cedo.body.error).toMatch(/24 horas/);
    expect(longe.status).toBe(400);
    expect(longe.body.error).toMatch(/30 dias/);
    expect(ok.status).toBe(201);
  });

  it('no pedido por turno a mensagem diz qual turno falhou', async () => {
    await salvarRegras();
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const noite = await prisma.turno.create({ data: { nome: 'Noite', horaInicio: '19:00', horaFim: '22:00' } });
    const pedir = (data: string) =>
      api()
        .post('/solicitacoes')
        .set('Authorization', prof.auth)
        .send({ recursoId: recurso.id, data, turnoIds: [noite.id] });

    // Hoje à noite fica a menos de 24 h (o teste não roda depois das 19:00 de amanhã)
    const hoje = await pedir(dataNoFuso(new Date()));
    const emTresDias = await pedir(dataNoFuso(daqui(72)));

    expect(hoje.status).toBe(400);
    expect(hoje.body.error).toMatch(/^Noite: /);
    expect(emTresDias.status).toBe(201);
  });

  it('admin lança reserva de última hora sem a regra', async () => {
    await salvarRegras();
    const admin = await criarUsuario('ADMIN');
    const recurso = await criarRecurso();

    const res = await api()
      .post('/solicitacoes/reservas')
      .set('Authorization', admin.auth)
      .send({
        recursoId: recurso.id,
        dataInicio: daqui(1),
        dataFim: daqui(2),
        institucional: true,
        observacao: 'Reunião do colegiado',
      });

    expect(res.status).toBe(201);
  });

  it('série pode passar do máximo, mas precisa começar dentro dele', async () => {
    await salvarRegras({ antecedenciaMinHoras: 24, antecedenciaMaxDias: 10 });
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const tarde = await prisma.turno.create({ data: { nome: 'Tarde', horaInicio: '14:00', horaFim: '18:00' } });
    const previa = (dataInicio: string) =>
      api()
        .post('/recorrencias/previa')
        .set('Authorization', prof.auth)
        .send({
          recursoId: recurso.id,
          turnoId: tarde.id,
          diasSemana: [diaDaSemana(dataInicio)],
          dataInicio,
          dataFim: somarDias(dataInicio, 28),
        });

    const dentro = await previa(dataNoFuso(daqui(72)));
    const foraDoLimite = await previa(somarDias(dataNoFuso(new Date()), 14));

    expect(dentro.status).toBe(200);
    expect(dentro.body.datas).toHaveLength(5);
    expect(dentro.body.datas.every((d: { ok: boolean }) => d.ok)).toBe(true);
    expect(foraDoLimite.status).toBe(400);
    expect(foraDoLimite.body.error).toMatch(/começar em no máximo 10 dias/);
  });

  it('data da série dentro do mínimo aparece como indisponível na prévia', async () => {
    await salvarRegras({ antecedenciaMinHoras: 72, antecedenciaMaxDias: 30 });
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const noite = await prisma.turno.create({ data: { nome: 'Noite', horaInicio: '19:00', horaFim: '22:00' } });
    const amanha = dataNoFuso(daqui(24));

    const res = await api()
      .post('/recorrencias/previa')
      .set('Authorization', prof.auth)
      .send({
        recursoId: recurso.id,
        turnoId: noite.id,
        diasSemana: [diaDaSemana(amanha)],
        dataInicio: amanha,
        dataFim: somarDias(amanha, 7),
      });

    expect(res.status).toBe(200);
    expect(res.body.datas[0]).toMatchObject({ ok: false, motivo: expect.stringMatching(/72 horas/) });
    expect(res.body.datas[1].ok).toBe(true);
  });

  it('todos leem as regras e só o admin altera', async () => {
    const prof = await criarUsuario();
    const admin = await criarUsuario('ADMIN');
    const alterar = (quem: { auth: string }, corpo: object) =>
      api().put('/configuracoes').set('Authorization', quem.auth).send(corpo);

    const padrao = await api().get('/configuracoes').set('Authorization', prof.auth);
    const negado = await alterar(prof, { antecedenciaMinHoras: 1, antecedenciaMaxDias: 10 });
    const invalido = await alterar(admin, { antecedenciaMinHoras: 24, antecedenciaMaxDias: 0 });
    const salvo = await alterar(admin, { antecedenciaMinHoras: 48, antecedenciaMaxDias: 15 });
    const parcial = await alterar(admin, { antecedenciaMaxDias: 20 });
    const depois = await api().get('/configuracoes').set('Authorization', prof.auth);

    // Sem linha salva valem os padrões do ambiente (0 h e 3650 dias nos testes)
    expect(padrao.body).toMatchObject({ antecedenciaMinHoras: 0, antecedenciaMaxDias: 3650 });
    expect(negado.status).toBe(403);
    expect(invalido.status).toBe(400);
    expect(salvo.status).toBe(200);
    expect(parcial.status).toBe(200);
    expect(depois.body).toEqual({
      antecedenciaMinHoras: 48,
      antecedenciaMaxDias: 20,
      ultimoDiaPermitido: somarDias(dataNoFuso(new Date()), 20),
    });
  });
});
