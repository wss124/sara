import { beforeEach, describe, expect, it } from 'vitest';
import { api, criarRecurso, criarUsuario, daqui, limparBanco, prisma } from './helpers';

async function pedido(usuarioId: string, recursoId: string, inicio: number, fim: number) {
  return prisma.solicitacao.create({
    data: { usuarioId, recursoId, dataInicio: daqui(inicio), dataFim: daqui(fim) },
  });
}

describe('aprovação de solicitações', () => {
  beforeEach(limparBanco);

  it('aprovações simultâneas de horários sobrepostos: só uma passa', async () => {
    // Cinco admins aprovam ao mesmo tempo cinco pedidos que se sobrepõem.
    // Repetido algumas vezes porque a corrida nem sempre acontece.
    for (let rodada = 0; rodada < 5; rodada++) {
      await limparBanco();
      const admins = await Promise.all([1, 2, 3, 4, 5].map(() => criarUsuario('ADMIN')));
      const prof = await criarUsuario();
      const recurso = await criarRecurso();
      const pedidos = await Promise.all(
        admins.map((_, i) => pedido(prof.id, recurso.id, 48 + i * 0.1, 50))
      );

      const respostas = await Promise.all(
        pedidos.map((p, i) =>
          api().patch(`/solicitacoes/${p.id}/aprovar`).set('Authorization', admins[i]!.auth)
        )
      );

      expect(respostas.map((r) => r.status).sort()).toEqual([200, 409, 409, 409, 409]);
      expect(await prisma.solicitacao.count({ where: { status: 'APROVADA' } })).toBe(1);
    }
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
