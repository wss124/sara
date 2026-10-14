import { beforeEach, describe, expect, it } from 'vitest';
import { api, criarRecurso, criarUsuario, daqui, limparBanco, prisma } from './helpers';

// Datashow com extensão obrigatória e apontador opcional (1 unidade cada)
async function cenario() {
  const prof = await criarUsuario();
  const admin = await criarUsuario('ADMIN');
  const datashow = await criarRecurso({ nome: 'Datashow' });
  const extensao = await prisma.acessorio.create({ data: { nome: 'Extensão', quantidade: 1 } });
  const apontador = await prisma.acessorio.create({ data: { nome: 'Apontador', quantidade: 1 } });
  await prisma.recursoAcessorio.createMany({
    data: [
      { recursoId: datashow.id, acessorioId: extensao.id, obrigatorio: true },
      { recursoId: datashow.id, acessorioId: apontador.id, obrigatorio: false },
    ],
  });
  return { prof, admin, datashow, extensao, apontador };
}

function pedir(auth: string, body: object) {
  return api().post('/solicitacoes').set('Authorization', auth).send(body);
}

describe('acessórios no pedido', () => {
  beforeEach(limparBanco);

  it('obrigatórios entram sozinhos e opcionais só se pedidos', async () => {
    const { prof, datashow, apontador } = await cenario();

    const sem = await pedir(prof.auth, { recursoId: datashow.id, dataInicio: daqui(24), dataFim: daqui(26) });
    const com = await pedir(prof.auth, {
      recursoId: datashow.id,
      dataInicio: daqui(48),
      dataFim: daqui(50),
      acessorios: [{ id: apontador.id }],
    });

    const nomes = (r: { body: { acessorios: { acessorio: { nome: string } }[] } }) =>
      r.body.acessorios.map((a) => a.acessorio.nome).sort();
    expect(sem.status).toBe(201);
    expect(nomes(sem)).toEqual(['Extensão']);
    expect(nomes(com)).toEqual(['Apontador', 'Extensão']);
  });

  it('rejeita acessório que não acompanha o recurso', async () => {
    const { prof, datashow } = await cenario();
    const outro = await prisma.acessorio.create({ data: { nome: 'Microfone' } });

    const res = await pedir(prof.auth, {
      recursoId: datashow.id,
      dataInicio: daqui(24),
      dataFim: daqui(26),
      acessorios: [{ id: outro.id }],
    });

    expect(res.status).toBe(400);
  });

  it('acessório sem estoque no período impede o pedido', async () => {
    const { prof, admin, datashow, extensao } = await cenario();
    // A única extensão já está comprometida com uma reserva de outra sala
    const sala = await criarRecurso({ nome: 'Sala 1' });
    await prisma.recursoAcessorio.create({ data: { recursoId: sala.id, acessorioId: extensao.id } });
    await api()
      .post('/solicitacoes/reservas')
      .set('Authorization', admin.auth)
      .send({
        recursoId: sala.id,
        dataInicio: daqui(24),
        dataFim: daqui(26),
        usuarioId: prof.id,
        acessorios: [{ id: extensao.id }],
      });

    const res = await pedir(prof.auth, { recursoId: datashow.id, dataInicio: daqui(25), dataFim: daqui(27) });
    const depois = await pedir(prof.auth, { recursoId: datashow.id, dataInicio: daqui(26), dataFim: daqui(28) });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Extensão');
    expect(depois.status).toBe(201);
  });

  it('aprovação confere o estoque de novo', async () => {
    const { prof, admin, datashow, extensao } = await cenario();
    const sala = await criarRecurso({ nome: 'Sala 1' });
    await prisma.recursoAcessorio.create({
      data: { recursoId: sala.id, acessorioId: extensao.id, obrigatorio: true },
    });
    // Dois pedidos pendentes disputam a única extensão
    const a = await pedir(prof.auth, { recursoId: datashow.id, dataInicio: daqui(24), dataFim: daqui(26) });
    const b = await pedir(prof.auth, { recursoId: sala.id, dataInicio: daqui(25), dataFim: daqui(27) });

    const primeira = await api().patch(`/solicitacoes/${a.body.id}/aprovar`).set('Authorization', admin.auth);
    const segunda = await api().patch(`/solicitacoes/${b.body.id}/aprovar`).set('Authorization', admin.auth);

    expect(primeira.status).toBe(200);
    expect(segunda.status).toBe(409);
  });

  it('informa as unidades livres do kit num período', async () => {
    const { prof, datashow, apontador } = await cenario();
    await prisma.solicitacao.create({
      data: {
        usuarioId: prof.id,
        recursoId: datashow.id,
        dataInicio: daqui(24),
        dataFim: daqui(26),
        status: 'APROVADA',
        acessorios: { create: [{ acessorioId: apontador.id }] },
      },
    });

    const res = await api()
      .get('/acessorios/disponibilidade')
      .query({ recursoId: datashow.id, inicio: daqui(25).toISOString(), fim: daqui(27).toISOString() })
      .set('Authorization', prof.auth);

    const livres = Object.fromEntries(res.body.map((a: { nome: string; livres: number }) => [a.nome, a.livres]));
    expect(livres).toEqual({ Extensão: 1, Apontador: 0 });
  });
});
