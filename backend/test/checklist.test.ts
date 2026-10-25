import { beforeEach, describe, expect, it } from 'vitest';
import { api, criarRecurso, criarUsuario, daqui, limparBanco, prisma } from './helpers';

// Reserva aprovada de um datashow que sai com extensão e cabo HDMI
async function cenario() {
  const admin = await criarUsuario('ADMIN');
  const prof = await criarUsuario();
  const datashow = await criarRecurso({ nome: 'Datashow' });
  const extensao = await prisma.acessorio.create({ data: { nome: 'Extensão', quantidade: 1 } });
  const hdmi = await prisma.acessorio.create({ data: { nome: 'Cabo HDMI', quantidade: 2 } });
  const reserva = await prisma.solicitacao.create({
    data: {
      usuarioId: prof.id,
      recursoId: datashow.id,
      dataInicio: daqui(0.5),
      dataFim: daqui(2),
      status: 'APROVADA',
      acessorios: { create: [{ acessorioId: extensao.id }, { acessorioId: hdmi.id }] },
    },
  });
  return { admin, prof, datashow, extensao, hdmi, reserva };
}

function retirar(auth: string, id: string, body: object) {
  return api().patch(`/solicitacoes/${id}/retirada`).set('Authorization', auth).send(body);
}

function devolver(auth: string, id: string, body: object) {
  return api().patch(`/solicitacoes/${id}/devolucao`).set('Authorization', auth).send(body);
}

describe('checklist de acessórios', () => {
  beforeEach(limparBanco);

  it('não conclui a retirada sem conferir os itens', async () => {
    const { admin, extensao, reserva } = await cenario();

    const res = await retirar(admin.auth, reserva.id, { itensConferidos: [extensao.id] });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Cabo HDMI');
  });

  it('aceita retirada com item faltando se houver justificativa', async () => {
    const { admin, extensao, reserva } = await cenario();

    const res = await retirar(admin.auth, reserva.id, {
      itensConferidos: [extensao.id],
      observacao: 'Professor trouxe o próprio cabo',
    });

    expect(res.status).toBe(200);
    expect(res.body.observacaoRetirada).toBe('Professor trouxe o próprio cabo');
    const entregues = res.body.acessorios.filter((a: { entregue: boolean }) => a.entregue);
    expect(entregues).toHaveLength(1);
  });

  it('devolução com item faltando fica INCOMPLETA e o item sai do estoque', async () => {
    const { admin, extensao, hdmi, reserva } = await cenario();
    await retirar(admin.auth, reserva.id, { itensConferidos: [extensao.id, hdmi.id] });

    const res = await devolver(admin.auth, reserva.id, { condicao: 'OK', itensDevolvidos: [hdmi.id] });

    expect(res.status).toBe(200);
    expect(res.body.condicaoDevolucao).toBe('INCOMPLETO');
    expect(res.body.observacaoDevolucao).toContain('Extensão');
    const porNome = Object.fromEntries(
      res.body.acessorios.map((a: { acessorio: { nome: string }; devolvido: boolean }) => [
        a.acessorio.nome,
        a.devolvido,
      ])
    );
    expect(porNome).toEqual({ Extensão: false, 'Cabo HDMI': true });
    const ext = await prisma.acessorio.findUnique({ where: { id: extensao.id } });
    expect(ext!.emFalta).toBe(1);
  });

  it('acessório em falta não pode ser pedido até ser regularizado', async () => {
    const { admin, prof, datashow, extensao, hdmi, reserva } = await cenario();
    await prisma.recursoAcessorio.create({
      data: { recursoId: datashow.id, acessorioId: extensao.id, obrigatorio: true },
    });
    await retirar(admin.auth, reserva.id, { itensConferidos: [extensao.id, hdmi.id] });
    await devolver(admin.auth, reserva.id, { itensDevolvidos: [hdmi.id] });

    const pedido = { recursoId: datashow.id, dataInicio: daqui(48), dataFim: daqui(50) };
    const antes = await api().post('/solicitacoes').set('Authorization', prof.auth).send(pedido);
    await api().patch(`/acessorios/${extensao.id}/regularizar`).set('Authorization', admin.auth);
    const depois = await api().post('/solicitacoes').set('Authorization', prof.auth).send(pedido);

    expect(antes.status).toBe(409);
    expect(depois.status).toBe(201);
  });

  it('devolução sem checklist considera que tudo voltou', async () => {
    const { admin, extensao, hdmi, reserva } = await cenario();
    await retirar(admin.auth, reserva.id, { itensConferidos: [extensao.id, hdmi.id] });

    const res = await devolver(admin.auth, reserva.id, {});

    expect(res.body.condicaoDevolucao).toBe('OK');
    expect(res.body.acessorios.every((a: { devolvido: boolean }) => a.devolvido)).toBe(true);
  });
});
