import { beforeEach, describe, expect, it } from 'vitest';
import { api, limparBanco } from './helpers';

describe('cadastro de usuários', () => {
  beforeEach(limparBanco);

  it('cria a conta como PROFESSOR', async () => {
    const res = await api()
      .post('/auth/register')
      .send({ nome: 'Maria', email: 'Maria@PRP.uespi.br', senha: '123456' });

    expect(res.status).toBe(201);
    expect(res.body.perfil).toBe('PROFESSOR');
    expect(res.body.email).toBe('maria@prp.uespi.br');
  });

  it('ignora um perfil enviado no corpo', async () => {
    const res = await api()
      .post('/auth/register')
      .send({ nome: 'Maria', email: 'maria@prp.uespi.br', senha: '123456', perfil: 'ADMIN' });

    expect(res.body.perfil).toBe('PROFESSOR');
  });

  it('rejeita e-mail de aluno', async () => {
    const res = await api()
      .post('/auth/register')
      .send({ nome: 'João', email: 'joao@aluno.uespi.br', senha: '123456' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('@prp.uespi.br');
  });
});
