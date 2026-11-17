import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Approvals from '../../src/pages/Approvals/Approvals';
import {
  aprovarSolicitacao,
  listarSolicitacoes,
  recusarSolicitacao,
} from '../../src/services/solicitacaoService';
import { aprovarSerie } from '../../src/services/recorrenciaService';

vi.mock('../../src/services/solicitacaoService', () => ({
  listarSolicitacoes: vi.fn(),
  aprovarSolicitacao: vi.fn(),
  recusarSolicitacao: vi.fn(),
  cancelarReserva: vi.fn(),
}));
vi.mock('../../src/services/recorrenciaService', () => ({
  aprovarSerie: vi.fn(),
  recusarSerie: vi.fn(),
}));
// Os modais têm testes e serviços próprios; aqui interessa só a lista
vi.mock('../../src/pages/Requests/RequestModal', () => ({ default: () => null }));
vi.mock('../../src/pages/Approvals/SemVagaModal', () => ({ default: () => null }));

const ANA = { id: 10, nome: 'Ana Souza', email: 'ana@uespi.br', perfil: 'PROFESSOR' };
const BRUNO = { id: 11, nome: 'Bruno Lima', email: 'bruno@uespi.br', perfil: 'PROFESSOR' };
const PROJETOR = { id: 1, nome: 'Projetor Epson', tipo: 'EQUIPAMENTO' };
const LAB = { id: 2, nome: 'Laboratório 1', tipo: 'SALA' };

function pedido(id, extra = {}) {
  return {
    id,
    status: 'PENDENTE',
    recurso: PROJETOR,
    usuario: ANA,
    dataInicio: '2026-11-25T08:00:00',
    dataFim: '2026-11-25T10:00:00',
    criadoEm: '2026-11-17T09:00:00',
    acessorios: [],
    ...extra,
  };
}

describe('Approvals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aprovarSolicitacao.mockResolvedValue({ semVaga: [] });
    recusarSolicitacao.mockResolvedValue({});
  });

  it('lista os pedidos pendentes com quem pediu', async () => {
    listarSolicitacoes.mockResolvedValue([pedido(1, { observacao: 'Aula de redes' })]);
    render(<Approvals />);

    expect(await screen.findByText('Projetor Epson')).toBeInTheDocument();
    expect(listarSolicitacoes).toHaveBeenCalledWith('PENDENTE');
    expect(screen.getByText('Solicitado por Ana Souza (Professor) · ana@uespi.br')).toBeInTheDocument();
    expect(screen.getByText('Aula de redes')).toBeInTheDocument();
  });

  it('avisa quando não há nada para aprovar', async () => {
    listarSolicitacoes.mockResolvedValue([]);
    render(<Approvals />);
    expect(await screen.findByText('Nenhuma solicitação aguardando aprovação.')).toBeInTheDocument();
  });

  it('aprova o pedido e recarrega a lista', async () => {
    const user = userEvent.setup();
    listarSolicitacoes.mockResolvedValueOnce([pedido(1)]).mockResolvedValueOnce([]);
    render(<Approvals />);

    await user.click(await screen.findByRole('button', { name: /Aprovar/ }));

    expect(aprovarSolicitacao).toHaveBeenCalledWith(1);
    expect(await screen.findByText('Solicitação aprovada.')).toBeInTheDocument();
    await waitFor(() => expect(listarSolicitacoes).toHaveBeenCalledTimes(2));
  });

  it('recusa o pedido enviando o motivo digitado', async () => {
    const user = userEvent.setup();
    listarSolicitacoes.mockResolvedValue([pedido(1)]);
    render(<Approvals />);

    await user.click(await screen.findByRole('button', { name: /Recusar/ }));
    await user.type(
      await screen.findByPlaceholderText('Motivo (opcional, enviado ao professor)'),
      'Equipamento reservado para evento'
    );
    await user.click(screen.getByRole('button', { name: 'Recusar' }));

    await waitFor(() =>
      expect(recusarSolicitacao).toHaveBeenCalledWith(1, 'Equipamento reservado para evento')
    );
  });

  it('mostra o erro do servidor quando a aprovação falha', async () => {
    const user = userEvent.setup();
    listarSolicitacoes.mockResolvedValue([pedido(1)]);
    aprovarSolicitacao.mockImplementation(async () => {
      throw Object.assign(new Error('409'), {
        response: { data: { error: 'O horário já foi reservado.' } },
      });
    });
    render(<Approvals />);

    await user.click(await screen.findByRole('button', { name: /Aprovar/ }));
    expect(await screen.findByText('O horário já foi reservado.')).toBeInTheDocument();
  });

  it('agrupa pedidos que disputam o mesmo horário em ordem de chegada', async () => {
    const user = userEvent.setup();
    const primeiro = pedido(1, { criadoEm: '2026-11-17T08:00:00' });
    const segundo = pedido(2, { usuario: BRUNO, criadoEm: '2026-11-17T09:30:00' });
    primeiro.fila = { posicao: 1, total: 2, concorrentes: [{ id: 2, usuario: BRUNO, criadoEm: segundo.criadoEm }] };
    segundo.fila = { posicao: 2, total: 2, concorrentes: [{ id: 1, usuario: ANA, criadoEm: primeiro.criadoEm }] };
    // A API pode devolver fora de ordem; a tela ordena pela chegada
    listarSolicitacoes.mockResolvedValue([segundo, primeiro]);
    render(<Approvals />);

    expect(await screen.findByText('2 pedidos disputam o mesmo horário')).toBeInTheDocument();
    const filas = screen.getAllByText(/º na fila de 2/).map((el) => el.textContent);
    expect(filas[0]).toMatch(/^1º/);
    expect(filas[1]).toMatch(/^2º/);

    // Aprovar o segundo da fila pede confirmação, citando quem pediu antes
    const doBruno = screen.getByText(/Bruno Lima/).closest('.request-item');
    await user.click(within(doBruno).getByRole('button', { name: /Aprovar/ }));
    expect(aprovarSolicitacao).not.toHaveBeenCalled();
    expect(await screen.findByText('Há pedidos anteriores para este horário')).toBeInTheDocument();
    expect(screen.getByText(/Ana Souza, pedido em 17\/11/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Aprovar este mesmo assim' }));
    await waitFor(() => expect(aprovarSolicitacao).toHaveBeenCalledWith(2));
  });

  it('junta as datas de uma série e aprova todas de uma vez', async () => {
    const user = userEvent.setup();
    const serie = {
      id: 7,
      diasSemana: [2],
      dataInicio: '2026-11-24T14:00:00',
      dataFim: '2026-12-08T18:00:00',
      horaInicio: '14:00',
      horaFim: '18:00',
    };
    const datas = ['2026-11-24', '2026-12-01', '2026-12-08'].map((d, i) =>
      pedido(20 + i, {
        recurso: LAB,
        recorrencia: serie,
        turno: { nome: 'Tarde' },
        dataInicio: `${d}T14:00:00`,
        dataFim: `${d}T18:00:00`,
      })
    );
    listarSolicitacoes.mockResolvedValue(datas);
    aprovarSerie.mockResolvedValue({ aprovadas: 3, falhas: [], semVaga: [] });
    render(<Approvals />);

    expect(await screen.findByText('Série semanal de Ana Souza · Laboratório 1')).toBeInTheDocument();
    expect(screen.getByText(/Toda terça, de 24\/11 a 08\/12\/2026 · Tarde \(14:00–18:00\) · 3 data\(s\) pendente\(s\)/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Aprovar série/ }));
    expect(aprovarSerie).toHaveBeenCalledWith(7);
    expect(await screen.findByText('3 data(s) da série aprovada(s).')).toBeInTheDocument();
  });

  it('troca o filtro de status e busca de novo', async () => {
    const user = userEvent.setup();
    listarSolicitacoes.mockResolvedValue([]);
    render(<Approvals />);
    await screen.findByText('Nenhuma solicitação aguardando aprovação.');

    await user.click(screen.getByText('Aprovadas'));
    await waitFor(() => expect(listarSolicitacoes).toHaveBeenLastCalledWith('APROVADA'));

    await user.click(screen.getByText('Todas'));
    await waitFor(() => expect(listarSolicitacoes).toHaveBeenLastCalledWith(undefined));
    expect(await screen.findByText('Nenhuma solicitação encontrada.')).toBeInTheDocument();
  });

  it('mostra o status e quem decidiu nos pedidos já analisados', async () => {
    listarSolicitacoes.mockResolvedValue([
      pedido(1, { status: 'RECUSADA', motivoRecusa: 'Sala em reforma', aprovadoPor: { nome: 'Admin' } }),
    ]);
    render(<Approvals />);

    const recusado = (await screen.findByText('Projetor Epson')).closest('.request-item');
    expect(within(recusado).getByText('Motivo da recusa: Sala em reforma')).toBeInTheDocument();
    expect(within(recusado).getByText('Recusada por Admin')).toBeInTheDocument();
    expect(within(recusado).queryByRole('button', { name: /Aprovar/ })).not.toBeInTheDocument();
  });
});
