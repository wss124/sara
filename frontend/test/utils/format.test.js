import { describe, expect, it } from 'vitest';
import {
  descreverAcessorios,
  descreverDias,
  descreverSerie,
  formatarPeriodo,
  getUsuarioLogado,
  periodoDaSolicitacao,
  responsavelPela,
} from '../../src/utils/format';

describe('formatarPeriodo', () => {
  it('mostra o dia uma vez quando o período cabe no mesmo dia', () => {
    expect(formatarPeriodo('2026-11-20T08:00:00', '2026-11-20T10:00:00')).toBe(
      'sex, 20/11/2026 · 08:00 – 10:00'
    );
  });

  it('mostra as datas completas quando atravessa dias', () => {
    expect(formatarPeriodo('2026-11-20T22:00:00', '2026-11-21T02:00:00')).toBe(
      '20/11/2026 22:00 – 21/11/2026 02:00'
    );
  });
});

describe('periodoDaSolicitacao', () => {
  const s = { dataInicio: '2026-11-20T14:00:00', dataFim: '2026-11-20T18:00:00' };

  it('inclui o turno quando o pedido foi feito por turno', () => {
    expect(periodoDaSolicitacao({ ...s, turno: { nome: 'Tarde' } })).toBe(
      'Tarde · sex, 20/11/2026 · 14:00 – 18:00'
    );
  });

  it('mostra só o período quando não há turno', () => {
    expect(periodoDaSolicitacao(s)).toBe('sex, 20/11/2026 · 14:00 – 18:00');
  });
});

describe('descreverDias', () => {
  it('usa "toda" para dias úteis e "todo" para o fim de semana', () => {
    expect(descreverDias([2])).toBe('toda terça');
    expect(descreverDias([6])).toBe('todo sábado');
    expect(descreverDias([0])).toBe('todo domingo');
  });

  it('lista vários dias começando pela segunda, com domingo no fim', () => {
    expect(descreverDias([4, 0, 2])).toBe('toda semana (terça, quinta e domingo)');
  });

  it('não altera o array recebido', () => {
    const dias = [4, 2];
    descreverDias(dias);
    expect(dias).toEqual([4, 2]);
  });
});

describe('descreverSerie', () => {
  it('descreve os dias e o intervalo da série', () => {
    const serie = {
      diasSemana: [2],
      dataInicio: '2026-10-20T08:00:00',
      dataFim: '2026-12-15T10:00:00',
    };
    expect(descreverSerie(serie)).toBe('Toda terça, de 20/10 a 15/12/2026');
  });
});

describe('getUsuarioLogado', () => {
  it('lê o usuário salvo na sessão', () => {
    localStorage.setItem('sara_user', JSON.stringify({ nome: 'Ana', perfil: 'PROFESSOR' }));
    expect(getUsuarioLogado()).toEqual({ nome: 'Ana', perfil: 'PROFESSOR' });
  });

  it('devolve null sem sessão ou com JSON inválido', () => {
    expect(getUsuarioLogado()).toBeNull();
    localStorage.setItem('sara_user', '{quebrado');
    expect(getUsuarioLogado()).toBeNull();
  });
});

describe('descreverAcessorios', () => {
  const itens = [
    { quantidade: 1, acessorio: { nome: 'Extensão' }, entregue: true, devolvido: null },
    { quantidade: 2, acessorio: { nome: 'Cabo HDMI' }, entregue: false, devolvido: null },
  ];

  it('lista os acessórios com a quantidade quando passa de um', () => {
    expect(descreverAcessorios(itens)).toBe('Extensão, Cabo HDMI (2)');
  });

  it('marca o que não foi entregue depois da retirada', () => {
    expect(descreverAcessorios(itens, true)).toBe('Extensão, Cabo HDMI (2) [não entregue]');
  });

  it('marca o que não voltou na devolução', () => {
    const devolucao = [{ ...itens[0], devolvido: false }];
    expect(descreverAcessorios(devolucao, true)).toBe('Extensão [não devolvido]');
  });

  it('devolve texto vazio sem acessórios', () => {
    expect(descreverAcessorios()).toBe('');
  });
});

describe('responsavelPela', () => {
  it('mostra o nome de quem pediu', () => {
    expect(responsavelPela({ institucional: false, usuario: { nome: 'Ana' } })).toBe('Ana');
  });

  it('mostra a finalidade no uso institucional', () => {
    expect(responsavelPela({ institucional: true, observacao: 'Semana acadêmica' })).toBe(
      'Uso institucional · Semana acadêmica'
    );
    expect(responsavelPela({ institucional: true })).toBe('Uso institucional');
  });
});
