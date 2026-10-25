import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api, criarRecurso, criarUsuario, daqui, limparBanco, prisma } from './helpers';
import { avisarAtrasos } from '../src/rotinas/atrasos';
import { estaAtrasada } from '../src/lib/status';

const enviados = vi.hoisted(() => [] as { para: string | string[]; assunto: string; texto: string }[]);
vi.mock('../src/lib/email', () => ({
  enviarEmSegundoPlano: (email: (typeof enviados)[number]) => enviados.push(email),
  enviarEmail: async () => true,
}));

const MINUTO = 60_000;

async function emUsoTerminandoEm(fim: Date) {
  const prof = await criarUsuario();
  const recurso = await criarRecurso({ nome: 'Projetor' });
  const reserva = await prisma.solicitacao.create({
    data: {
      usuarioId: prof.id,
      recursoId: recurso.id,
      dataInicio: new Date(fim.getTime() - 120 * MINUTO),
      dataFim: fim,
      status: 'EM_ANDAMENTO',
    },
  });
  return { prof, recurso, reserva };
}

describe('devoluções atrasadas', () => {
  beforeEach(async () => {
    await limparBanco();
    enviados.length = 0;
  });

  it('respeita a tolerância de 15 minutos', () => {
    const fim = new Date('2026-10-14T17:00:00Z');
    const r = { status: 'EM_ANDAMENTO', dataFim: fim };
    expect(estaAtrasada(r, new Date(fim.getTime() + 14 * MINUTO))).toBe(false);
    expect(estaAtrasada(r, new Date(fim.getTime() + 16 * MINUTO))).toBe(true);
    expect(estaAtrasada({ ...r, status: 'CONCLUIDA' }, new Date(fim.getTime() + 60 * MINUTO))).toBe(false);
  });

  it('avisa o professor e os admins uma única vez', async () => {
    await criarUsuario('ADMIN');
    const fim = daqui(-1);
    const { prof } = await emUsoTerminandoEm(fim);

    const primeira = await avisarAtrasos(new Date());
    const segunda = await avisarAtrasos(new Date());
    await vi.waitFor(() => expect(enviados).toHaveLength(2));

    expect(primeira).toBe(1);
    expect(segunda).toBe(0);
    expect(enviados.find((e) => e.para === prof.email)?.assunto).toBe('Devolução atrasada: Projetor');
  });

  it('não avisa dentro da tolerância', async () => {
    const agora = new Date();
    await emUsoTerminandoEm(new Date(agora.getTime() - 5 * MINUTO));

    expect(await avisarAtrasos(agora)).toBe(0);
  });

  it('o aviso aos admins cita a próxima reserva do recurso', async () => {
    await criarUsuario('ADMIN');
    const { recurso } = await emUsoTerminandoEm(daqui(-1));
    const outro = await criarUsuario();
    await prisma.solicitacao.create({
      data: {
        usuarioId: outro.id,
        recursoId: recurso.id,
        dataInicio: daqui(0.5),
        dataFim: daqui(2),
        status: 'APROVADA',
      },
    });

    await avisarAtrasos(new Date());
    await vi.waitFor(() => expect(enviados).toHaveLength(2));

    const paraAdmins = enviados.find((e) => Array.isArray(e.para))!;
    expect(paraAdmins.texto).toContain(`Próxima reserva: ${outro.nome}`);
  });

  it('o balcão marca a reserva como atrasada', async () => {
    const admin = await criarUsuario('ADMIN');
    const { reserva } = await emUsoTerminandoEm(daqui(-1));

    const res = await api().get('/solicitacoes/movimentacoes').set('Authorization', admin.auth);

    expect(res.body.emUso.find((r: { id: string }) => r.id === reserva.id).atrasada).toBe(true);
  });
});
