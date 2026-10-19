import { beforeEach, describe, expect, it } from 'vitest';
import { api, criarRecurso, criarUsuario, daqui, limparBanco, prisma } from './helpers';
import { montarFila } from '../src/lib/fila';

function pedidoNaFila(id: string, inicio: number, fim: number, chegada: number, recursoId = 'r1') {
  return {
    id,
    recursoId,
    dataInicio: daqui(inicio),
    dataFim: daqui(fim),
    criadoEm: new Date(2026, 9, 1, 8, chegada),
  };
}

async function pedir(usuarioId: string, recursoId: string, inicio: number, fim: number, minutosAtras: number) {
  return prisma.solicitacao.create({
    data: {
      usuarioId,
      recursoId,
      dataInicio: daqui(inicio),
      dataFim: daqui(fim),
      criadoEm: new Date(Date.now() - minutosAtras * 60_000),
    },
  });
}

describe('fila de pedidos concorrentes', () => {
  beforeEach(limparBanco);

  it('ordena por chegada só os pedidos que se sobrepõem', () => {
    const fila = montarFila([
      pedidoNaFila('b', 48, 50, 2),
      pedidoNaFila('a', 49, 51, 1),
      pedidoNaFila('encostado', 51, 52, 0),
      pedidoNaFila('outro-recurso', 48, 50, 0, 'r2'),
    ]);

    expect(fila.get('a')).toMatchObject({ posicao: 1, total: 2 });
    expect(fila.get('b')).toMatchObject({ posicao: 2, total: 2 });
    expect(fila.get('b')!.concorrentes.map((c) => c.id)).toEqual(['a']);
    expect(fila.has('encostado')).toBe(false);
    expect(fila.has('outro-recurso')).toBe(false);
  });

  it('admin vê a posição e quem disputa o horário', async () => {
    const admin = await criarUsuario('ADMIN');
    const [p1, p2] = [await criarUsuario(), await criarUsuario()];
    const recurso = await criarRecurso();
    const primeiro = await pedir(p1.id, recurso.id, 48, 50, 30);
    const segundo = await pedir(p2.id, recurso.id, 49, 51, 10);

    const res = await api().get('/solicitacoes?status=PENDENTE').set('Authorization', admin.auth);
    const porId = Object.fromEntries(res.body.map((s: { id: string }) => [s.id, s]));

    expect(porId[primeiro.id].fila).toMatchObject({ posicao: 1, total: 2 });
    expect(porId[segundo.id].fila).toMatchObject({
      posicao: 2,
      concorrentes: [{ id: primeiro.id, usuario: { nome: p1.nome } }],
    });
  });

  it('professor vê só a própria posição, sem os concorrentes', async () => {
    const [p1, p2] = [await criarUsuario(), await criarUsuario()];
    const recurso = await criarRecurso();
    await pedir(p1.id, recurso.id, 48, 50, 30);
    await pedir(p2.id, recurso.id, 48, 50, 10);
    await pedir(p2.id, recurso.id, 60, 62, 5);

    const res = await api().get('/solicitacoes/minhas').set('Authorization', p2.auth);
    const filas = res.body.map((s: { fila: unknown }) => s.fila);

    expect(filas).toContainEqual({ posicao: 2, total: 2 });
    expect(filas).toContainEqual(null);
  });

  it('aprovar devolve os pedidos que ficaram sem vaga, sem recusá-los', async () => {
    const admin = await criarUsuario('ADMIN');
    const [p1, p2] = [await criarUsuario(), await criarUsuario()];
    const recurso = await criarRecurso();
    const primeiro = await pedir(p1.id, recurso.id, 48, 50, 30);
    const segundo = await pedir(p2.id, recurso.id, 49, 51, 10);

    const res = await api().patch(`/solicitacoes/${primeiro.id}/aprovar`).set('Authorization', admin.auth);

    expect(res.status).toBe(200);
    expect(res.body.semVaga.map((s: { id: string }) => s.id)).toEqual([segundo.id]);
    expect((await prisma.solicitacao.findUniqueOrThrow({ where: { id: segundo.id } })).status).toBe('PENDENTE');
  });

  it('informa quantos pedidos pendentes já disputam um período', async () => {
    const [p1, p2] = [await criarUsuario(), await criarUsuario()];
    const recurso = await criarRecurso();
    await pedir(p1.id, recurso.id, 48, 50, 30);

    const consultar = (inicio: number, fim: number) =>
      api()
        .get('/solicitacoes/pendentes-no-periodo')
        .query({ recursoId: recurso.id, inicio: daqui(inicio).toISOString(), fim: daqui(fim).toISOString() })
        .set('Authorization', p2.auth);

    expect((await consultar(49, 51)).body).toEqual({ pendentes: 1 });
    expect((await consultar(50, 52)).body).toEqual({ pendentes: 0 });
  });
});
