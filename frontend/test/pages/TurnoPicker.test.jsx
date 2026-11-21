import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import TurnoPicker from '../../src/pages/Requests/TurnoPicker';

const TURNOS = [
  { id: 1, nome: 'Manhã', horaInicio: '07:00', horaFim: '11:00' },
  { id: 2, nome: 'Tarde', horaInicio: '14:00', horaFim: '18:00' },
  { id: 3, nome: 'Noite', horaInicio: '19:00', horaFim: '22:00' },
];
const DIA = dayjs('2026-11-20');

// A manhã está toda tomada e a tarde tem uma reserva no meio
const RESERVAS = [
  { dataInicio: '2026-11-20T07:00:00', dataFim: '2026-11-20T11:00:00' },
  { dataInicio: '2026-11-20T15:00:00', dataFim: '2026-11-20T16:00:00' },
];

const botao = (nome) => screen.getByRole('button', { name: new RegExp(nome) });

describe('TurnoPicker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-18T10:00:00'));
  });
  afterEach(() => vi.useRealTimers());

  it('pede o recurso e a data antes de mostrar os turnos', () => {
    render(<TurnoPicker data={null} turnos={TURNOS} reservas={[]} />);
    expect(screen.getByText(/Escolha o recurso e a data/)).toBeInTheDocument();
  });

  it('avisa quando não há turnos cadastrados', () => {
    render(<TurnoPicker data={DIA} turnos={[]} reservas={[]} />);
    expect(screen.getByText(/Nenhum turno cadastrado/)).toBeInTheDocument();
  });

  it('mostra a situação de cada turno e só libera os livres', () => {
    render(<TurnoPicker data={DIA} turnos={TURNOS} reservas={RESERVAS} />);

    expect(botao('Manhã')).toBeDisabled();
    expect(botao('Manhã')).toHaveTextContent('Ocupado');

    expect(botao('Tarde')).toBeDisabled();
    expect(botao('Tarde')).toHaveTextContent('Parcialmente ocupado');
    expect(botao('Tarde')).toHaveTextContent('Ocupado: 15:00–16:00');

    expect(botao('Noite')).toBeEnabled();
    expect(botao('Noite')).toHaveTextContent('Livre');
  });

  it('bloqueia os turnos antes da antecedência mínima', () => {
    const liberado = dayjs('2026-11-20T12:00:00');
    render(<TurnoPicker data={DIA} turnos={TURNOS} reservas={[]} liberadoAPartirDe={liberado} />);
    expect(botao('Manhã')).toBeDisabled();
    expect(botao('Manhã')).toHaveTextContent('Fora do prazo');
    expect(botao('Tarde')).toBeEnabled();
  });

  it('marca e desmarca o turno ao clicar', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <TurnoPicker data={DIA} turnos={TURNOS} reservas={[]} value={[]} onChange={onChange} />
    );

    await user.click(botao('Tarde'));
    expect(onChange).toHaveBeenLastCalledWith([2]);

    rerender(<TurnoPicker data={DIA} turnos={TURNOS} reservas={[]} value={[2]} onChange={onChange} />);
    expect(botao('Tarde')).toHaveAttribute('aria-pressed', 'true');

    await user.click(botao('Noite'));
    expect(onChange).toHaveBeenLastCalledWith([2, 3]);

    await user.click(botao('Tarde'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
