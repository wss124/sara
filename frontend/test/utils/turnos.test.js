import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import dayjs from 'dayjs';
import { periodoDoTurno, situacaoDoTurno } from '../../src/utils/turnos';

const TARDE = { nome: 'Tarde', horaInicio: '14:00', horaFim: '18:00' };
const DIA = dayjs('2026-11-20'); // sexta

const reserva = (inicio, fim) => ({
  dataInicio: `2026-11-20T${inicio}:00`,
  dataFim: `2026-11-20T${fim}:00`,
});

describe('periodoDoTurno', () => {
  it('monta início e fim do turno no dia escolhido', () => {
    const [inicio, fim] = periodoDoTurno(DIA, TARDE);
    expect(inicio.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-11-20 14:00:00');
    expect(fim.format('YYYY-MM-DD HH:mm:ss')).toBe('2026-11-20 18:00:00');
  });

  it('aceita minutos quebrados', () => {
    const [inicio, fim] = periodoDoTurno(DIA, { horaInicio: '07:30', horaFim: '11:45' });
    expect(inicio.format('HH:mm')).toBe('07:30');
    expect(fim.format('HH:mm')).toBe('11:45');
  });
});

describe('situacaoDoTurno', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-18T10:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('fica LIVRE quando não há reservas', () => {
    expect(situacaoDoTurno(DIA, TARDE, []).situacao).toBe('LIVRE');
  });

  it('ignora reservas que só encostam no turno', () => {
    const r = situacaoDoTurno(DIA, TARDE, [reserva('08:00', '14:00'), reserva('18:00', '20:00')]);
    expect(r.situacao).toBe('LIVRE');
    expect(r.conflitos).toHaveLength(0);
  });

  it('fica PARCIAL quando uma reserva ocupa só parte do turno', () => {
    const r = situacaoDoTurno(DIA, TARDE, [reserva('15:00', '16:00')]);
    expect(r.situacao).toBe('PARCIAL');
    expect(r.conflitos).toHaveLength(1);
  });

  it('fica OCUPADO quando uma reserva cobre o turno inteiro', () => {
    expect(situacaoDoTurno(DIA, TARDE, [reserva('13:00', '19:00')]).situacao).toBe('OCUPADO');
  });

  it('fica OCUPADO com reservas emendadas, mesmo fora de ordem', () => {
    const reservas = [reserva('16:00', '18:00'), reserva('14:00', '16:00')];
    expect(situacaoDoTurno(DIA, TARDE, reservas).situacao).toBe('OCUPADO');
  });

  it('fica PARCIAL quando as reservas deixam um buraco', () => {
    const reservas = [reserva('14:00', '15:00'), reserva('16:00', '18:00')];
    expect(situacaoDoTurno(DIA, TARDE, reservas).situacao).toBe('PARCIAL');
  });

  it('fica ENCERRADO quando o turno já começou', () => {
    vi.setSystemTime(new Date('2026-11-20T14:30:00'));
    expect(situacaoDoTurno(DIA, TARDE, []).situacao).toBe('ENCERRADO');
  });

  it('fica FORA_DO_PRAZO quando começa antes da antecedência mínima', () => {
    const liberado = dayjs('2026-11-20T15:00:00');
    expect(situacaoDoTurno(DIA, TARDE, [], liberado).situacao).toBe('FORA_DO_PRAZO');
  });

  it('respeita a antecedência quando o turno começa depois do limite', () => {
    const liberado = dayjs('2026-11-19T10:00:00');
    expect(situacaoDoTurno(DIA, TARDE, [], liberado).situacao).toBe('LIVRE');
  });
});
