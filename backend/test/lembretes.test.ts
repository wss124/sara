import { beforeEach, describe, expect, it, vi } from 'vitest';
import { criarRecurso, criarUsuario, limparBanco, prisma } from './helpers';
import { lembrarRetiradas, lembrarDevolucoes, enviarResumoDiario } from '../src/rotinas/lembretes';
import { instanteNoFuso, inicioDoDiaNoFuso, dataNoFuso } from '../src/lib/fuso';

const enviados = vi.hoisted(() => [] as { para: string | string[]; assunto: string; texto: string }[]);
vi.mock('../src/lib/email', () => ({
  enviarEmSegundoPlano: (email: (typeof enviados)[number]) => enviados.push(email),
  enviarEmail: async () => true,
}));

const MINUTO = 60_000;
// Relógio simulado: 14/10/2026 às 13:00 no campus (UTC-3)
const AGORA = new Date('2026-10-14T16:00:00Z');
const em = (min: number) => new Date(AGORA.getTime() + min * MINUTO);

async function reserva(status: 'APROVADA' | 'EM_ANDAMENTO', inicio: Date, fim: Date) {
  const prof = await criarUsuario();
  const recurso = await criarRecurso({ nome: 'Projetor' });
  await prisma.solicitacao.create({
    data: { usuarioId: prof.id, recursoId: recurso.id, dataInicio: inicio, dataFim: fim, status },
  });
  return prof;
}

describe('fuso horário do campus', () => {
  it('converte horário local em instante UTC', () => {
    expect(instanteNoFuso('2026-10-14', '13:30').toISOString()).toBe('2026-10-14T16:30:00.000Z');
  });

  it('a meia-noite local de 01:00 UTC ainda é o dia anterior no campus', () => {
    const madrugadaUtc = new Date('2026-10-15T01:00:00Z'); // 22:00 do dia 14 no campus
    expect(dataNoFuso(madrugadaUtc)).toBe('2026-10-14');
    expect(inicioDoDiaNoFuso(madrugadaUtc).toISOString()).toBe('2026-10-14T03:00:00.000Z');
  });
});

describe('lembretes por e-mail', () => {
  beforeEach(async () => {
    await limparBanco();
    enviados.length = 0;
  });

  it('lembra da retirada uma hora antes, uma única vez', async () => {
    const prof = await reserva('APROVADA', em(45), em(165));

    expect(await lembrarRetiradas(AGORA)).toBe(1);
    expect(await lembrarRetiradas(em(5))).toBe(0);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]).toMatchObject({ para: prof.email });
    expect(enviados[0]!.assunto).toContain('Lembrete: Projetor');
  });

  it('não lembra de reservas distantes', async () => {
    await reserva('APROVADA', em(120), em(240));
    expect(await lembrarRetiradas(AGORA)).toBe(0);
  });

  it('lembra da devolução 15 minutos antes do fim', async () => {
    await reserva('EM_ANDAMENTO', em(-60), em(10));

    expect(await lembrarDevolucoes(AGORA)).toBe(1);
    expect(enviados[0]!.assunto).toContain('Lembrete: devolver Projetor');
  });

  it('resumo diário sai depois das 7h e só uma vez por dia', async () => {
    await criarUsuario('ADMIN');
    await reserva('APROVADA', em(60), em(120));
    const seisDaManha = new Date('2026-10-14T09:00:00Z');

    expect(await enviarResumoDiario(seisDaManha)).toBe(false);
    expect(await enviarResumoDiario(AGORA)).toBe(true);
    expect(await enviarResumoDiario(em(60))).toBe(false);

    await vi.waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0]!.texto).toContain('Retiradas previstas para hoje: 1');
  });
});
