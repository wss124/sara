import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, criarRecurso, criarUsuario, daqui, limparBanco, prisma } from './helpers';
import { formatarPeriodo } from '../src/lib/fuso';

// Captura os e-mails em vez de enviá-los
const enviados = vi.hoisted(() => [] as { para: string | string[]; assunto: string; texto: string }[]);
vi.mock('../src/lib/email', () => ({
  enviarEmSegundoPlano: (email: (typeof enviados)[number]) => enviados.push(email),
  enviarEmail: async () => true,
}));

// Envios para admins dependem de uma consulta ao banco: espera eles chegarem
async function aguardarEmails(quantidade: number) {
  await vi.waitFor(() => expect(enviados.length).toBeGreaterThanOrEqual(quantidade));
}

describe('e-mails do fluxo de reservas', () => {
  beforeEach(async () => {
    await limparBanco();
    enviados.length = 0;
  });

  it('pedido criado avisa o professor e os admins', async () => {
    const admin = await criarUsuario('ADMIN');
    const prof = await criarUsuario();
    const recurso = await criarRecurso({ nome: 'Projetor' });

    await api()
      .post('/solicitacoes')
      .set('Authorization', prof.auth)
      .send({ recursoId: recurso.id, dataInicio: daqui(24), dataFim: daqui(26) });
    await aguardarEmails(2);

    expect(enviados.map((e) => [e.para, e.assunto])).toEqual(
      expect.arrayContaining([
        [prof.email, 'Pedido recebido: Projetor'],
        [[admin.email], 'Novo pedido para aprovar: Projetor'],
      ])
    );
  });

  it('aprovação informa local de retirada e acessórios, com datas em pt-BR', async () => {
    const admin = await criarUsuario('ADMIN');
    const prof = await criarUsuario();
    const recurso = await prisma.recurso.create({
      data: { nome: 'Projetor', tipo: 'EQUIPAMENTO', localizacao: 'Coordenação' },
    });
    const extensao = await prisma.acessorio.create({ data: { nome: 'Extensão', localizacao: 'Dispensa' } });
    const pedido = await prisma.solicitacao.create({
      data: {
        usuarioId: prof.id,
        recursoId: recurso.id,
        dataInicio: daqui(24),
        dataFim: daqui(26),
        acessorios: { create: [{ acessorioId: extensao.id }] },
      },
    });

    await api().patch(`/solicitacoes/${pedido.id}/aprovar`).set('Authorization', admin.auth);

    const email = enviados.find((e) => e.assunto === 'Reserva aprovada: Projetor')!;
    expect(email.para).toBe(prof.email);
    expect(email.texto).toContain('Retirar em: Coordenação');
    expect(email.texto).toContain('Extensão, em Dispensa');
    expect(email.texto).toContain(formatarPeriodo(pedido.dataInicio, pedido.dataFim));
  });

  it('recusa leva o motivo', async () => {
    const admin = await criarUsuario('ADMIN');
    const prof = await criarUsuario();
    const recurso = await criarRecurso({ nome: 'Sala 1' });
    const pedido = await prisma.solicitacao.create({
      data: { usuarioId: prof.id, recursoId: recurso.id, dataInicio: daqui(24), dataFim: daqui(26) },
    });

    const res = await api()
      .patch(`/solicitacoes/${pedido.id}/recusar`)
      .set('Authorization', admin.auth)
      .send({ motivo: 'Sala reservada para a colação' });

    expect(res.body.motivoRecusa).toBe('Sala reservada para a colação');
    const email = enviados.find((e) => e.assunto === 'Pedido recusado: Sala 1')!;
    expect(email.texto).toContain('Motivo: Sala reservada para a colação');
  });

  it('reserva institucional não gera e-mail de professor', async () => {
    const admin = await criarUsuario('ADMIN');
    const recurso = await criarRecurso();

    await api()
      .post('/solicitacoes/reservas')
      .set('Authorization', admin.auth)
      .send({
        recursoId: recurso.id,
        dataInicio: daqui(24),
        dataFim: daqui(26),
        institucional: true,
        observacao: 'Prova',
      });

    expect(enviados).toHaveLength(0);
  });

  it('recurso em manutenção avisa quem tem reserva futura', async () => {
    const admin = await criarUsuario('ADMIN');
    const prof = await criarUsuario();
    const recurso = await criarRecurso({ nome: 'Notebook' });
    await prisma.solicitacao.create({
      data: {
        usuarioId: prof.id,
        recursoId: recurso.id,
        dataInicio: daqui(24),
        dataFim: daqui(26),
        status: 'APROVADA',
      },
    });

    await api()
      .patch(`/recursos/${recurso.id}/estado`)
      .set('Authorization', admin.auth)
      .send({ estado: 'EM_MANUTENCAO' });

    expect(enviados.map((e) => [e.para, e.assunto])).toEqual([
      [prof.email, 'Atenção: Notebook entrou em manutenção'],
    ]);
  });

  it('cancelamento pelo professor avisa os admins', async () => {
    const admin = await criarUsuario('ADMIN');
    const prof = await criarUsuario();
    const recurso = await criarRecurso({ nome: 'Sala 2' });
    const reserva = await prisma.solicitacao.create({
      data: {
        usuarioId: prof.id,
        recursoId: recurso.id,
        dataInicio: daqui(24),
        dataFim: daqui(26),
        status: 'APROVADA',
      },
    });

    await api().delete(`/solicitacoes/${reserva.id}`).set('Authorization', prof.auth);
    await aguardarEmails(1);

    expect(enviados[0]).toMatchObject({
      para: [admin.email],
      assunto: 'Reserva cancelada pelo professor: Sala 2',
    });
  });
});
