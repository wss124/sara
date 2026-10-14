import { beforeEach, describe, expect, it } from 'vitest';
import { api, criarRecurso, criarUsuario, daqui, limparBanco, prisma } from './helpers';

describe('estado operacional do recurso', () => {
  beforeEach(limparBanco);

  it('novo recurso nasce DISPONIVEL', async () => {
    const admin = await criarUsuario('ADMIN');
    const res = await api()
      .post('/recursos')
      .set('Authorization', admin.auth)
      .send({ nome: 'Projetor', tipo: 'EQUIPAMENTO' });

    expect(res.body.estado).toBe('DISPONIVEL');
  });

  it('apenas o admin altera o estado', async () => {
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const res = await api()
      .patch(`/recursos/${recurso.id}/estado`)
      .set('Authorization', prof.auth)
      .send({ estado: 'EM_MANUTENCAO' });

    expect(res.status).toBe(403);
  });

  it('não permite definir EM_USO manualmente', async () => {
    const admin = await criarUsuario('ADMIN');
    const recurso = await criarRecurso();
    const res = await api()
      .patch(`/recursos/${recurso.id}/estado`)
      .set('Authorization', admin.auth)
      .send({ estado: 'EM_USO' });

    expect(res.status).toBe(400);
  });

  it('não muda o estado de um recurso em uso', async () => {
    const admin = await criarUsuario('ADMIN');
    const recurso = await criarRecurso();
    await prisma.recurso.update({ where: { id: recurso.id }, data: { estado: 'EM_USO' } });
    const res = await api()
      .patch(`/recursos/${recurso.id}/estado`)
      .set('Authorization', admin.auth)
      .send({ estado: 'EM_MANUTENCAO' });

    expect(res.status).toBe(409);
  });

  it.each(['EM_MANUTENCAO', 'INDISPONIVEL'] as const)(
    'bloqueia solicitação de recurso %s',
    async (estado) => {
      const prof = await criarUsuario();
      const recurso = await criarRecurso();
      await prisma.recurso.update({ where: { id: recurso.id }, data: { estado } });

      const res = await api()
        .post('/solicitacoes')
        .set('Authorization', prof.auth)
        .send({ recursoId: recurso.id, dataInicio: daqui(48), dataFim: daqui(50) });

      expect(res.status).toBe(409);
    }
  );

  it('bloqueia a aprovação se o recurso entrou em manutenção depois do pedido', async () => {
    const admin = await criarUsuario('ADMIN');
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const pedido = await prisma.solicitacao.create({
      data: { usuarioId: prof.id, recursoId: recurso.id, dataInicio: daqui(48), dataFim: daqui(50) },
    });
    await prisma.recurso.update({ where: { id: recurso.id }, data: { estado: 'EM_MANUTENCAO' } });

    const res = await api().patch(`/solicitacoes/${pedido.id}/aprovar`).set('Authorization', admin.auth);

    expect(res.status).toBe(409);
  });
});
