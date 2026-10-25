import { beforeEach, describe, expect, it } from 'vitest';
import { api, criarRecurso, criarUsuario, daqui, limparBanco, prisma } from './helpers';

async function reservaAprovada(inicio: number, fim: number) {
  const prof = await criarUsuario();
  const recurso = await criarRecurso();
  const reserva = await prisma.solicitacao.create({
    data: {
      usuarioId: prof.id,
      recursoId: recurso.id,
      dataInicio: daqui(inicio),
      dataFim: daqui(fim),
      status: 'APROVADA',
    },
  });
  return { prof, recurso, reserva };
}

describe('retirada e devolução', () => {
  beforeEach(limparBanco);

  it('retirada deixa a reserva EM_ANDAMENTO e o recurso EM_USO', async () => {
    const admin = await criarUsuario('ADMIN');
    const { recurso, reserva } = await reservaAprovada(0.5, 2);

    const res = await api().patch(`/solicitacoes/${reserva.id}/retirada`).set('Authorization', admin.auth);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('EM_ANDAMENTO');
    expect(res.body.retiradaRegistradaPor.id).toBe(admin.id);
    const atualizado = await prisma.recurso.findUnique({ where: { id: recurso.id } });
    expect(atualizado!.estado).toBe('EM_USO');
  });

  it('devolução conclui a reserva e libera o recurso', async () => {
    const admin = await criarUsuario('ADMIN');
    const { recurso, reserva } = await reservaAprovada(0.5, 2);
    await api().patch(`/solicitacoes/${reserva.id}/retirada`).set('Authorization', admin.auth);

    const res = await api().patch(`/solicitacoes/${reserva.id}/devolucao`).set('Authorization', admin.auth);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CONCLUIDA');
    expect(res.body.devolvidoEm).toBeTruthy();
    const atualizado = await prisma.recurso.findUnique({ where: { id: recurso.id } });
    expect(atualizado!.estado).toBe('DISPONIVEL');
  });

  it('não registra retirada muito antes do horário', async () => {
    const admin = await criarUsuario('ADMIN');
    const { reserva } = await reservaAprovada(5, 7);

    const res = await api().patch(`/solicitacoes/${reserva.id}/retirada`).set('Authorization', admin.auth);

    expect(res.status).toBe(409);
  });

  it('não devolve o que não foi retirado', async () => {
    const admin = await criarUsuario('ADMIN');
    const { reserva } = await reservaAprovada(0.5, 2);

    const res = await api().patch(`/solicitacoes/${reserva.id}/devolucao`).set('Authorization', admin.auth);

    expect(res.status).toBe(409);
  });

  it('não retira um recurso que ainda está com outra pessoa', async () => {
    const admin = await criarUsuario('ADMIN');
    const { recurso, reserva } = await reservaAprovada(0.5, 2);
    await prisma.recurso.update({ where: { id: recurso.id }, data: { estado: 'EM_USO' } });

    const res = await api().patch(`/solicitacoes/${reserva.id}/retirada`).set('Authorization', admin.auth);

    expect(res.status).toBe(409);
  });

  it('professor não registra retirada', async () => {
    const { prof, reserva } = await reservaAprovada(0.5, 2);

    const res = await api().patch(`/solicitacoes/${reserva.id}/retirada`).set('Authorization', prof.auth);

    expect(res.status).toBe(403);
  });

  it('professor cancela reserva aprovada ainda não retirada', async () => {
    const { prof, reserva } = await reservaAprovada(24, 26);

    const res = await api().delete(`/solicitacoes/${reserva.id}`).set('Authorization', prof.auth);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELADA');
  });

  it('reserva cancelada libera o horário para outro pedido ser aprovado', async () => {
    const admin = await criarUsuario('ADMIN');
    const { prof, recurso, reserva } = await reservaAprovada(24, 26);
    await api().delete(`/solicitacoes/${reserva.id}`).set('Authorization', prof.auth);
    const outro = await prisma.solicitacao.create({
      data: { usuarioId: prof.id, recursoId: recurso.id, dataInicio: daqui(24), dataFim: daqui(26) },
    });

    const res = await api().patch(`/solicitacoes/${outro.id}/aprovar`).set('Authorization', admin.auth);

    expect(res.status).toBe(200);
  });

  it('lista as movimentações do balcão', async () => {
    const admin = await criarUsuario('ADMIN');
    const { reserva } = await reservaAprovada(0.5, 2);

    const antes = await api().get('/solicitacoes/movimentacoes').set('Authorization', admin.auth);
    expect(antes.body.aguardandoRetirada.map((r: { id: string }) => r.id)).toContain(reserva.id);

    await api().patch(`/solicitacoes/${reserva.id}/retirada`).set('Authorization', admin.auth);
    const depois = await api().get('/solicitacoes/movimentacoes').set('Authorization', admin.auth);
    expect(depois.body.emUso.map((r: { id: string }) => r.id)).toContain(reserva.id);
  });
});
