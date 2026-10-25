import http from 'http';
import type { AddressInfo } from 'net';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, criarRecurso, criarUsuario, daqui, limparBanco } from './helpers';
import { app } from '../src/app';
import { totalDeConexoes } from '../src/lib/eventos';

// O SSE precisa de uma conexão de verdade aberta: sobe o app numa porta livre
let servidor: http.Server;
let porta: number;

beforeAll(async () => {
  servidor = app.listen(0);
  await new Promise((ok) => servidor.once('listening', ok));
  porta = (servidor.address() as AddressInfo).port;
});

afterAll(() => new Promise((ok) => servidor.close(ok)));

// Abre /dashboard/eventos e acumula o que o servidor enviar
function conectar(token?: string) {
  return new Promise<{ status: number; recebido: () => string; fechar: () => void }>((ok, falha) => {
    const caminho = `/dashboard/eventos${token ? `?token=${token}` : ''}`;
    const req = http.get({ port: porta, path: caminho }, (res) => {
      let texto = '';
      res.setEncoding('utf8');
      res.on('data', (parte) => (texto += parte));
      ok({ status: res.statusCode!, recebido: () => texto, fechar: () => req.destroy() });
    });
    req.on('error', falha);
  });
}

async function esperar(condicao: () => boolean, limiteMs = 3000) {
  const inicio = Date.now();
  while (!condicao()) {
    if (Date.now() - inicio > limiteMs) throw new Error('Tempo esgotado esperando o evento.');
    await new Promise((ok) => setTimeout(ok, 20));
  }
}

const pausa = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
const token = (u: { auth: string }) => u.auth.replace('Bearer ', '');

describe('dashboard em tempo real (SSE)', () => {
  beforeEach(limparBanco);

  it('exige token válido', async () => {
    const semToken = await conectar();
    const invalido = await conectar('abc');

    expect(semToken.status).toBe(401);
    expect(invalido.status).toBe(401);
  });

  it('avisa o dashboard aberto quando um pedido é criado e aprovado', async () => {
    const prof = await criarUsuario();
    const admin = await criarUsuario('ADMIN');
    const recurso = await criarRecurso();
    const conexao = await conectar(token(admin));
    expect(conexao.status).toBe(200);

    const pedido = await api()
      .post('/solicitacoes')
      .set('Authorization', prof.auth)
      .send({ recursoId: recurso.id, dataInicio: daqui(24), dataFim: daqui(26) });
    await esperar(() => conexao.recebido().split('event: atualizacao').length === 2);

    await api().patch(`/solicitacoes/${pedido.body.id}/aprovar`).set('Authorization', admin.auth);
    await esperar(() => conexao.recebido().split('event: atualizacao').length === 3);

    conexao.fechar();
  });

  it('não avisa em consultas nem em ações recusadas', async () => {
    const prof = await criarUsuario();
    const conexao = await conectar(token(prof));

    await api().get('/dashboard').set('Authorization', prof.auth);
    await api().post('/solicitacoes').set('Authorization', prof.auth).send({});
    await pausa(500);

    expect(conexao.recebido()).not.toContain('event: atualizacao');
    conexao.fechar();
  });

  it('agrupa alterações seguidas num aviso só', async () => {
    const admin = await criarUsuario('ADMIN');
    const conexao = await conectar(token(admin));

    await Promise.all(
      [1, 2, 3].map((n) =>
        api().post('/turnos').set('Authorization', admin.auth).send({
          nome: `T${n}`,
          horaInicio: `0${n}:00`,
          horaFim: `0${n}:30`,
        })
      )
    );
    await esperar(() => conexao.recebido().includes('event: atualizacao'));
    await pausa(500);

    expect(conexao.recebido().split('event: atualizacao').length).toBe(2);
    conexao.fechar();
  });

  it('libera a conexão quando o dashboard fecha', async () => {
    const prof = await criarUsuario();
    const antes = totalDeConexoes();
    const conexao = await conectar(token(prof));
    await esperar(() => totalDeConexoes() === antes + 1);

    conexao.fechar();
    await esperar(() => totalDeConexoes() === antes);
  });
});
