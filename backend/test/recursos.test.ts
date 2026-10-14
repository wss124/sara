import { beforeEach, describe, expect, it } from 'vitest';
import { api, criarUsuario, limparBanco } from './helpers';

describe('cadastro de recursos', () => {
  beforeEach(limparBanco);

  it('salva e edita a localização', async () => {
    const admin = await criarUsuario('ADMIN');
    const criado = await api()
      .post('/recursos')
      .set('Authorization', admin.auth)
      .send({ nome: 'Extensão 5 m', tipo: 'EQUIPAMENTO', localizacao: '  Dispensa do Bloco B ' });

    expect(criado.body.localizacao).toBe('Dispensa do Bloco B');

    const editado = await api()
      .put(`/recursos/${criado.body.id}`)
      .set('Authorization', admin.auth)
      .send({ localizacao: '' });

    expect(editado.body.localizacao).toBeNull();
  });
});
