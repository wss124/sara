import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Statistics from '../../src/pages/Statistics/Statistics';
import { carregarEstatisticas } from '../../src/services/estatisticaService';

vi.mock('../../src/services/estatisticaService', () => ({ carregarEstatisticas: vi.fn() }));

function estatisticas(extra = {}) {
  return {
    periodo: { inicio: '2026-10-19', fim: '2026-11-17', diasUteis: 22 },
    ocupacao: { taxa: 38, periodosOcupados: 50, periodosPossiveis: 132 },
    porRecurso: [
      { id: 1, nome: 'Laboratório 1', taxa: 64, periodosOcupados: 42, horasReservadas: 150.5 },
      { id: 2, nome: 'Projetor Epson', taxa: 12, periodosOcupados: 1, horasReservadas: 2 },
    ],
    porTurno: [
      { id: 1, nome: 'Manhã', horaInicio: '07:00', horaFim: '11:00', taxa: 45, periodosOcupados: 20 },
      { id: 2, nome: 'Tarde', horaInicio: '14:00', horaFim: '18:00', taxa: 30, periodosOcupados: 13 },
    ],
    porDiaDaSemana: [
      { dia: 'Segunda', taxa: 50, periodosOcupados: 12 },
      { dia: 'Terça', taxa: 40, periodosOcupados: 10 },
    ],
    pedidos: { total: 20, aprovados: 12, pendentes: 3, recusados: 4, cancelados: 1, taxaAprovacao: 75 },
    pedidosPorSemana: [
      { semana: '2026-11-02', total: 5 },
      { semana: '2026-11-09', total: 8 },
    ],
    ocorrencias: { devolucoesAtrasadas: 2, devolucoesComProblema: 0, reservasNaoRetiradas: 1 },
    ...extra,
  };
}

// Painel pelo título (h3), para procurar os números dentro dele. O nome do
// título também leva o rótulo do ícone de ajuda, por isso compara o começo.
const painel = (titulo) =>
  screen.getByRole('heading', { name: new RegExp(`^${titulo}`) }).closest('section');

describe('Statistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-17T10:00:00'));
    carregarEstatisticas.mockResolvedValue(estatisticas());
  });
  afterEach(() => vi.useRealTimers());

  it('busca os últimos 30 dias ao abrir', async () => {
    render(<Statistics />);
    await screen.findByText('Taxa de ocupação');
    expect(carregarEstatisticas).toHaveBeenCalledWith('2026-10-19', '2026-11-17');
  });

  it('mostra os indicadores do período', async () => {
    render(<Statistics />);

    expect(await screen.findByText('38%')).toBeInTheDocument();
    expect(screen.getByText('50 de 132 períodos')).toBeInTheDocument();
    expect(screen.getByText('3 aguardando decisão')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('12 aprovados, 4 recusados')).toBeInTheDocument();
    // 150,5 h + 2 h, arredondado
    expect(screen.getByText('153 h')).toBeInTheDocument();
    expect(screen.getByText('em 22 dias úteis')).toBeInTheDocument();
  });

  it('desenha os gráficos com os valores de cada recurso', async () => {
    render(<Statistics />);
    await screen.findByText('Taxa de ocupação');

    const recursos = painel('Ocupação por recurso');
    expect(within(recursos).getByText('Laboratório 1')).toBeInTheDocument();
    expect(within(recursos).getByText('64%')).toBeInTheDocument();

    const ocorrencias = painel('Ocorrências');
    expect(within(ocorrencias).getByText('Devoluções atrasadas').closest('li')).toHaveClass(
      'tem-ocorrencia'
    );
    expect(
      within(ocorrencias).getByText('Devolvidos com defeito ou incompletos').closest('li')
    ).not.toHaveClass('tem-ocorrencia');
  });

  it('troca para tabelas com o detalhe de cada linha', async () => {
    const user = userEvent.setup();
    render(<Statistics />);
    await screen.findByText('Taxa de ocupação');

    await user.click(screen.getByText('Tabelas'));

    const recursos = painel('Ocupação por recurso');
    expect(within(recursos).getByRole('table')).toBeInTheDocument();
    expect(within(recursos).getByText('42 períodos ocupados · 150.5 h reservadas')).toBeInTheDocument();
    expect(within(recursos).getByText('1 período ocupado · 2 h reservadas')).toBeInTheDocument();

    const turnos = painel('Ocupação por turno');
    expect(within(turnos).getByText('07:00–11:00 · 20 períodos ocupados')).toBeInTheDocument();

    // 12 de 20 pedidos aprovados
    const situacao = painel('Situação dos pedidos');
    const aprovados = within(situacao).getByText('Aprovados').closest('tr');
    expect(within(aprovados).getByText('12')).toBeInTheDocument();
    expect(within(aprovados).getByText('60%')).toBeInTheDocument();

    const semanas = painel('Pedidos por semana');
    expect(within(semanas).getByText('09/11')).toBeInTheDocument();
    expect(within(semanas).getByText('8')).toBeInTheDocument();
  });

  it('pede o cadastro de turnos quando não há nenhum', async () => {
    carregarEstatisticas.mockResolvedValue(estatisticas({ porTurno: [] }));
    render(<Statistics />);

    expect(await screen.findByText('Cadastre os turnos para calcular a ocupação.')).toBeInTheDocument();
    expect(screen.getByText('Nenhum turno cadastrado.')).toBeInTheDocument();
  });

  it('mostra o erro do servidor quando não consegue carregar', async () => {
    carregarEstatisticas.mockImplementation(async () => {
      throw Object.assign(new Error('400'), { response: { data: { error: 'Período inválido.' } } });
    });
    render(<Statistics />);

    expect(await screen.findByText('Período inválido.')).toBeInTheDocument();
  });
});
