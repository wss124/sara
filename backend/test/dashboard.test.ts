import { beforeEach, describe, expect, it } from 'vitest';
import { api, criarRecurso, criarUsuario, daqui, limparBanco, prisma } from './helpers';

describe('dashboard', () => {
  beforeEach(limparBanco);

  it('mostra a situação real de cada recurso e os contadores', async () => {
    const admin = await criarUsuario('ADMIN');
    const prof = await criarUsuario();
    const [livre, aguardando, emUso, atrasado, manutencao] = await Promise.all(
      ['A Livre', 'B Aguardando', 'C Em uso', 'D Atrasado', 'E Manutenção'].map((nome) =>
        criarRecurso({ nome })
      )
    );
    await prisma.recurso.update({ where: { id: manutencao!.id }, data: { estado: 'EM_MANUTENCAO' } });
    const reserva = (recursoId: string, status: 'APROVADA' | 'EM_ANDAMENTO', inicio: number, fim: number) =>
      prisma.solicitacao.create({
        data: { usuarioId: prof.id, recursoId, status, dataInicio: daqui(inicio), dataFim: daqui(fim) },
      });
    await reserva(aguardando!.id, 'APROVADA', -0.5, 1);
    await reserva(emUso!.id, 'EM_ANDAMENTO', -1, 1);
    await reserva(atrasado!.id, 'EM_ANDAMENTO', -3, -1);
    await reserva(livre!.id, 'APROVADA', 3, 4);

    const res = await api().get('/dashboard').set('Authorization', admin.auth);

    const situacoes = Object.fromEntries(
      res.body.ocupacao.map((r: { nome: string; situacao: string }) => [r.nome, r.situacao])
    );
    expect(situacoes).toEqual({
      'A Livre': 'LIVRE',
      'B Aguardando': 'AGUARDANDO_RETIRADA',
      'C Em uso': 'EM_USO',
      'D Atrasado': 'ATRASADO',
      'E Manutenção': 'EM_MANUTENCAO',
    });
    expect(res.body.recursos).toMatchObject({
      total: 5,
      ocupados: 3,
      livres: 1,
      emUso: 1,
      aguardandoRetirada: 1,
      atrasados: 1,
      emManutencao: 1,
    });
    // A próxima reserva do recurso livre aparece no card
    const cardLivre = res.body.ocupacao.find((r: { nome: string }) => r.nome === 'A Livre');
    expect(cardLivre.proxima).not.toBeNull();
  });
});
