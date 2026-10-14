import { beforeEach, describe, expect, it } from 'vitest';
import { api, criarRecurso, criarUsuario, daqui, limparBanco, prisma } from './helpers';

async function pedido(usuarioId: string, recursoId: string, inicio: number, fim: number) {
  return prisma.solicitacao.create({
    data: { usuarioId, recursoId, dataInicio: daqui(inicio), dataFim: daqui(fim) },
  });
}

describe('aprovação de solicitações', () => {
  beforeEach(limparBanco);

  it('duas aprovações simultâneas do mesmo horário: só uma passa', async () => {
    const [admin1, admin2, prof1, prof2] = await Promise.all([
      criarUsuario('ADMIN'),
      criarUsuario('ADMIN'),
      criarUsuario(),
      criarUsuario(),
    ]);
    const recurso = await criarRecurso();
    const a = await pedido(prof1.id, recurso.id, 48, 50);
    const b = await pedido(prof2.id, recurso.id, 49, 51);

    const respostas = await Promise.all([
      api().patch(`/solicitacoes/${a.id}/aprovar`).set('Authorization', admin1.auth),
      api().patch(`/solicitacoes/${b.id}/aprovar`).set('Authorization', admin2.auth),
    ]);

    expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
    const aprovadas = await prisma.solicitacao.count({ where: { status: 'APROVADA' } });
    expect(aprovadas).toBe(1);
  });

  it('reservas encostadas (fim = início) não conflitam', async () => {
    const admin = await criarUsuario('ADMIN');
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const a = await pedido(prof.id, recurso.id, 48, 50);
    const b = await pedido(prof.id, recurso.id, 50, 52);

    for (const s of [a, b]) {
      const res = await api().patch(`/solicitacoes/${s.id}/aprovar`).set('Authorization', admin.auth);
      expect(res.status).toBe(200);
    }
  });

  it('não aprova sobre uma reserva já aprovada', async () => {
    const admin = await criarUsuario('ADMIN');
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const a = await pedido(prof.id, recurso.id, 48, 50);
    const b = await pedido(prof.id, recurso.id, 49, 51);

    await api().patch(`/solicitacoes/${a.id}/aprovar`).set('Authorization', admin.auth);
    const res = await api().patch(`/solicitacoes/${b.id}/aprovar`).set('Authorization', admin.auth);

    expect(res.status).toBe(409);
  });
});
