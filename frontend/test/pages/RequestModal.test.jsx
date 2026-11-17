import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RequestModal from '../../src/pages/Requests/RequestModal';
import { listarRecursos } from '../../src/services/recursoService';
import {
  consultarOcupacao,
  consultarPendentesNoPeriodo,
  criarSolicitacao,
  lancarReserva,
} from '../../src/services/solicitacaoService';
import { listarTurnos } from '../../src/services/turnoService';
import { listarUsuarios } from '../../src/services/usuarioService';
import { obterConfiguracao } from '../../src/services/configuracaoService';

vi.mock('../../src/services/recursoService', () => ({ listarRecursos: vi.fn() }));
vi.mock('../../src/services/solicitacaoService', () => ({
  consultarOcupacao: vi.fn(),
  consultarPendentesNoPeriodo: vi.fn(),
  criarSolicitacao: vi.fn(),
  lancarReserva: vi.fn(),
}));
vi.mock('../../src/services/turnoService', () => ({ listarTurnos: vi.fn() }));
vi.mock('../../src/services/usuarioService', () => ({ listarUsuarios: vi.fn() }));
vi.mock('../../src/services/configuracaoService', () => ({ obterConfiguracao: vi.fn() }));
vi.mock('../../src/services/recorrenciaService', () => ({ criarSerie: vi.fn(), previaSerie: vi.fn() }));
vi.mock('../../src/services/acessorioService', () => ({
  consultarDisponibilidadeAcessorios: vi.fn(),
}));

const TURNOS = [
  { id: 1, nome: 'Manhã', horaInicio: '07:00', horaFim: '11:00', ativo: true },
  { id: 2, nome: 'Tarde', horaInicio: '14:00', horaFim: '18:00', ativo: true },
  { id: 3, nome: 'Noite', horaInicio: '19:00', horaFim: '22:00', ativo: false },
];
const RECURSOS = [
  { id: 1, nome: 'Laboratório 1', tipo: 'SALA', estado: 'DISPONIVEL', ativo: true, localizacao: 'Bloco B' },
  { id: 2, nome: 'Projetor Epson', tipo: 'EQUIPAMENTO', estado: 'EM_MANUTENCAO', ativo: true },
  { id: 3, nome: 'Sala antiga', tipo: 'SALA', estado: 'DISPONIVEL', ativo: false },
];
const REGRAS = { antecedenciaMinHoras: 24, antecedenciaMaxDias: 30, ultimoDiaPermitido: '2026-12-17' };

function abrir(props = {}) {
  const onCreated = vi.fn();
  render(<RequestModal open onClose={vi.fn()} onCreated={onCreated} {...props} />);
  return { onCreated, user: userEvent.setup() };
}

const turno = (nome) => screen.findByRole('button', { name: new RegExp(nome) });

describe('RequestModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-17T10:00:00'));
    listarTurnos.mockResolvedValue(TURNOS);
    listarRecursos.mockResolvedValue(RECURSOS);
    obterConfiguracao.mockResolvedValue(REGRAS);
    listarUsuarios.mockResolvedValue([]);
    consultarOcupacao.mockResolvedValue([]);
    consultarPendentesNoPeriodo.mockResolvedValue(0);
    criarSolicitacao.mockImplementation(async (p) => p.turnoIds.map((id) => ({ id })));
  });
  afterEach(() => vi.useRealTimers());

  describe('professor', () => {
    it('explica o prazo de antecedência', async () => {
      abrir();
      expect(
        await screen.findByText('Peça com pelo menos 24 horas e no máximo 30 dias de antecedência.')
      ).toBeInTheDocument();
    });

    it('não envia sem recurso, data e turno', async () => {
      const { user } = abrir();
      await screen.findByText(/Peça com pelo menos/);

      await user.click(screen.getByRole('button', { name: 'Enviar solicitação' }));

      expect(await screen.findByText('Escolha um recurso.')).toBeInTheDocument();
      expect(screen.getByText('Escolha a data.')).toBeInTheDocument();
      expect(screen.getByText('Escolha pelo menos um turno.')).toBeInTheDocument();
      expect(criarSolicitacao).not.toHaveBeenCalled();
    });

    it('mostra só os turnos ativos e o local de retirada do recurso', async () => {
      abrir({ recursoInicial: 1, dataInicial: '2026-11-20' });

      expect(await turno('Manhã')).toBeEnabled();
      expect(await turno('Tarde')).toBeEnabled();
      expect(screen.queryByRole('button', { name: /Noite/ })).not.toBeInTheDocument();
      expect(screen.getByText(/Retirada em: Bloco B/)).toBeInTheDocument();
      expect(consultarOcupacao).toHaveBeenCalledWith(
        1,
        new Date('2026-11-20T00:00:00').toISOString(),
        new Date('2026-11-20T23:59:59.999').toISOString()
      );
    });

    it('envia um pedido por turno marcado', async () => {
      const { user, onCreated } = abrir({ recursoInicial: 1, dataInicial: '2026-11-20' });

      await user.click(await turno('Manhã'));
      await user.click(await turno('Tarde'));
      await user.type(
        screen.getByPlaceholderText('Ex.: aula prática da disciplina de Redes'),
        'Aula de redes'
      );
      await user.click(screen.getByRole('button', { name: 'Enviar solicitação' }));

      await waitFor(() => expect(onCreated).toHaveBeenCalled());
      expect(criarSolicitacao).toHaveBeenCalledWith({
        recursoId: 1,
        observacao: 'Aula de redes',
        acessorios: [],
        data: '2026-11-20',
        turnoIds: [1, 2],
      });
      expect(
        await screen.findByText(/2 solicitações enviadas, uma por turno/)
      ).toBeInTheDocument();
    });

    it('bloqueia o turno que começa antes da antecedência mínima', async () => {
      // Amanhã de manhã fica a menos de 24 horas; a tarde já pode
      abrir({ recursoInicial: 1, dataInicial: '2026-11-18' });

      expect(await turno('Manhã')).toBeDisabled();
      expect(await turno('Manhã')).toHaveTextContent('Fora do prazo');
      expect(await turno('Tarde')).toBeEnabled();
    });

    it('desabilita no calendário os dias fora do prazo', async () => {
      const { user } = abrir();
      await screen.findByText(/Peça com pelo menos/);

      await user.click(screen.getByLabelText('Data'));

      const dia = (data) => document.querySelector(`td[title="${data}"]`);
      await waitFor(() => expect(dia('2026-11-17')).not.toBeNull());
      expect(dia('2026-11-17')).toHaveClass('ant-picker-cell-disabled');
      expect(dia('2026-11-18')).not.toHaveClass('ant-picker-cell-disabled');
      expect(dia('2026-11-30')).not.toHaveClass('ant-picker-cell-disabled');
    });

    it('avisa quando já há pedidos na fila para o horário', async () => {
      consultarPendentesNoPeriodo.mockResolvedValue(2);
      const { user } = abrir({ recursoInicial: 1, dataInicial: '2026-11-20' });

      await user.click(await turno('Tarde'));

      expect(
        await screen.findByText('Já há 2 pedido(s) aguardando aprovação neste horário.')
      ).toBeInTheDocument();
      expect(screen.getByText(/seu pedido entra na fila como o 3º/)).toBeInTheDocument();
    });

    it('marca como indisponível o recurso em manutenção e esconde o inativo', async () => {
      const { user } = abrir();
      await screen.findByText(/Peça com pelo menos/);

      await user.click(screen.getByRole('combobox', { name: 'Recurso' }));

      const lista = await screen.findByRole('listbox');
      expect(lista).toBeInTheDocument();
      const manutencao = await screen.findByTitle('Projetor Epson (em manutenção)');
      expect(manutencao.closest('.ant-select-item')).toHaveClass('ant-select-item-option-disabled');
      expect(screen.queryByTitle('Sala antiga')).not.toBeInTheDocument();
    });

    it('mostra o erro do servidor e mantém o modal aberto', async () => {
      criarSolicitacao.mockImplementation(async () => {
        throw Object.assign(new Error('400'), {
          response: { data: { error: 'Você já tem um pedido nesse horário.' } },
        });
      });
      const { user, onCreated } = abrir({ recursoInicial: 1, dataInicial: '2026-11-20' });

      await user.click(await turno('Tarde'));
      await user.click(screen.getByRole('button', { name: 'Enviar solicitação' }));

      expect(await screen.findByText('Você já tem um pedido nesse horário.')).toBeInTheDocument();
      expect(onCreated).not.toHaveBeenCalled();
    });
  });

  describe('admin', () => {
    it('não consulta as regras de antecedência', async () => {
      abrir({ admin: true });
      expect(await screen.findByText('Nova reserva')).toBeInTheDocument();
      await waitFor(() => expect(listarUsuarios).toHaveBeenCalled());
      expect(obterConfiguracao).not.toHaveBeenCalled();
      expect(screen.queryByText('Repetição')).not.toBeInTheDocument();
    });

    it('exige a finalidade no uso institucional e registra a reserva', async () => {
      lancarReserva.mockResolvedValue([{ id: 9, pendentesConflitantes: 1 }]);
      const { user, onCreated } = abrir({ admin: true, recursoInicial: 1, dataInicial: '2026-11-20' });

      await user.click(await screen.findByText('Uso institucional'));
      await user.click(await turno('Tarde'));
      await user.click(screen.getByRole('button', { name: 'Registrar reserva' }));
      expect(await screen.findByText('Descreva a finalidade.')).toBeInTheDocument();
      expect(lancarReserva).not.toHaveBeenCalled();

      await user.type(screen.getByLabelText('Finalidade'), 'Prova de Cálculo I');
      await user.click(screen.getByRole('button', { name: 'Registrar reserva' }));

      await waitFor(() => expect(onCreated).toHaveBeenCalled());
      expect(lancarReserva).toHaveBeenCalledWith({
        recursoId: 1,
        observacao: 'Prova de Cálculo I',
        acessorios: [],
        data: '2026-11-20',
        turnoIds: [2],
        institucional: true,
        usuarioId: undefined,
      });
      expect(
        await screen.findByText(/Há 1 solicitação\(ões\) pendente\(s\) nesse horário/)
      ).toBeInTheDocument();
    });

    it('pede o responsável quando a reserva é para um usuário', async () => {
      const { user } = abrir({ admin: true, recursoInicial: 1, dataInicial: '2026-11-20' });

      await user.click(await turno('Tarde'));
      await user.click(screen.getByRole('button', { name: 'Registrar reserva' }));

      expect(await screen.findByText('Escolha o responsável pela reserva.')).toBeInTheDocument();
      expect(lancarReserva).not.toHaveBeenCalled();
      const modal = screen.getByRole('dialog');
      expect(within(modal).getByText('Responsável')).toBeInTheDocument();
    });
  });
});
