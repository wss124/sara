import { beforeEach, describe, expect, it } from 'vitest';
import { api, criarRecurso, criarUsuario, limparBanco, prisma } from './helpers';

describe('acessórios', () => {
  beforeEach(limparBanco);

  it('admin cadastra acessório e define o kit do recurso', async () => {
    const admin = await criarUsuario('ADMIN');
    const recurso = await criarRecurso({ nome: 'Datashow' });

    const extensao = await api()
      .post('/acessorios')
      .set('Authorization', admin.auth)
      .send({ nome: 'Extensão', quantidade: 2, localizacao: 'Dispensa' });
    const apontador = await api()
      .post('/acessorios')
      .set('Authorization', admin.auth)
      .send({ nome: 'Apontador' });

    expect(extensao.status).toBe(201);

    const kit = await api()
      .put(`/recursos/${recurso.id}/acessorios`)
      .set('Authorization', admin.auth)
      .send({
        itens: [
          { acessorioId: apontador.body.id, obrigatorio: false },
          { acessorioId: extensao.body.id, obrigatorio: true },
        ],
      });

    expect(kit.status).toBe(200);
    // Obrigatórios primeiro
    expect(kit.body.map((a: { nome: string; obrigatorio: boolean }) => [a.nome, a.obrigatorio])).toEqual([
      ['Extensão', true],
      ['Apontador', false],
    ]);
  });

  it('o detalhe do recurso mostra o kit', async () => {
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const acessorio = await prisma.acessorio.create({ data: { nome: 'Cabo HDMI' } });
    await prisma.recursoAcessorio.create({
      data: { recursoId: recurso.id, acessorioId: acessorio.id, obrigatorio: true },
    });

    const res = await api().get(`/recursos/${recurso.id}`).set('Authorization', prof.auth);

    expect(res.body.acessorios).toHaveLength(1);
    expect(res.body.acessorios[0]).toMatchObject({ nome: 'Cabo HDMI', obrigatorio: true });
  });

  it('acessório inativo não aparece para o professor', async () => {
    const prof = await criarUsuario();
    const recurso = await criarRecurso();
    const acessorio = await prisma.acessorio.create({ data: { nome: 'Cabo antigo', ativo: false } });
    await prisma.recursoAcessorio.create({ data: { recursoId: recurso.id, acessorioId: acessorio.id } });

    const lista = await api().get('/recursos').set('Authorization', prof.auth);
    const acessorios = await api().get('/acessorios').set('Authorization', prof.auth);

    expect(lista.body[0].acessorios).toHaveLength(0);
    expect(acessorios.body).toHaveLength(0);
  });

  it('rejeita kit com acessório repetido', async () => {
    const admin = await criarUsuario('ADMIN');
    const recurso = await criarRecurso();
    const acessorio = await prisma.acessorio.create({ data: { nome: 'Extensão' } });

    const res = await api()
      .put(`/recursos/${recurso.id}/acessorios`)
      .set('Authorization', admin.auth)
      .send({
        itens: [
          { acessorioId: acessorio.id, obrigatorio: true },
          { acessorioId: acessorio.id, obrigatorio: false },
        ],
      });

    expect(res.status).toBe(400);
  });

  it('professor não cadastra acessório', async () => {
    const prof = await criarUsuario();
    const res = await api().post('/acessorios').set('Authorization', prof.auth).send({ nome: 'X' });
    expect(res.status).toBe(403);
  });
});
