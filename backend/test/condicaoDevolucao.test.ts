import { beforeEach, describe, expect, it } from 'vitest';
import { api, criarRecurso, criarUsuario, daqui, limparBanco, prisma } from './helpers';

async function cenarioEmUso() {
  const admin = await criarUsuario('ADMIN');
  const prof = await criarUsuario();
  const recurso = await criarRecurso();
  const reserva = await prisma.solicitacao.create({
    data: {
      usuarioId: prof.id,
      recursoId: recurso.id,
      dataInicio: daqui(-1),
      dataFim: daqui(1),
      status: 'EM_ANDAMENTO',
      retiradoEm: daqui(-1),
    },
  });
  await prisma.recurso.update({ where: { id: recurso.id }, data: { estado: 'EM_USO' } });
  return { admin, prof, recurso, reserva };
}

describe('condição na devolução', () => {
  beforeEach(limparBanco);

  it('devolução com defeito coloca o recurso em manutenção e lista reservas afetadas', async () => {
    const { admin, prof, recurso, reserva } = await cenarioEmUso();
    const futura = await prisma.solicitacao.create({
      data: {
        usuarioId: prof.id,
        recursoId: recurso.id,
        dataInicio: daqui(24),
        dataFim: daqui(26),
        status: 'APROVADA',
      },
    });

    const res = await api()
      .patch(`/solicitacoes/${reserva.id}/devolucao`)
      .set('Authorization', admin.auth)
      .send({ condicao: 'COM_DEFEITO', observacao: 'Lâmpada queimada' });

    expect(res.status).toBe(200);
    expect(res.body.condicaoDevolucao).toBe('COM_DEFEITO');
    expect(res.body.reservasAfetadas.map((r: { id: string }) => r.id)).toEqual([futura.id]);
    const atualizado = await prisma.recurso.findUnique({ where: { id: recurso.id } });
    expect(atualizado!.estado).toBe('EM_MANUTENCAO');
  });

  it('exige observação quando a condição não é OK', async () => {
    const { admin, reserva } = await cenarioEmUso();

    const res = await api()
      .patch(`/solicitacoes/${reserva.id}/devolucao`)
      .set('Authorization', admin.auth)
      .send({ condicao: 'INCOMPLETO' });

    expect(res.status).toBe(400);
  });

  it('devolução incompleta mantém o recurso disponível', async () => {
    const { admin, recurso, reserva } = await cenarioEmUso();

    await api()
      .patch(`/solicitacoes/${reserva.id}/devolucao`)
      .set('Authorization', admin.auth)
      .send({ condicao: 'INCOMPLETO', observacao: 'Faltou o controle remoto' });

    const atualizado = await prisma.recurso.findUnique({ where: { id: recurso.id } });
    expect(atualizado!.estado).toBe('DISPONIVEL');
  });

  it('recurso em manutenção some das opções de pedido', async () => {
    const { admin, prof, recurso, reserva } = await cenarioEmUso();
    await api()
      .patch(`/solicitacoes/${reserva.id}/devolucao`)
      .set('Authorization', admin.auth)
      .send({ condicao: 'COM_DEFEITO', observacao: 'Não liga' });

    const res = await api()
      .post('/solicitacoes')
      .set('Authorization', prof.auth)
      .send({ recursoId: recurso.id, dataInicio: daqui(48), dataFim: daqui(50) });

    expect(res.status).toBe(409);
  });

  it('admin cancela reserva afetada informando o motivo', async () => {
    const { admin, prof, recurso } = await cenarioEmUso();
    const futura = await prisma.solicitacao.create({
      data: {
        usuarioId: prof.id,
        recursoId: recurso.id,
        dataInicio: daqui(24),
        dataFim: daqui(26),
        status: 'APROVADA',
      },
    });

    const res = await api()
      .patch(`/solicitacoes/${futura.id}/cancelamento`)
      .set('Authorization', admin.auth)
      .send({ motivo: 'Recurso em manutenção' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELADA');
    expect(res.body.motivoCancelamento).toBe('Recurso em manutenção');
  });
});
