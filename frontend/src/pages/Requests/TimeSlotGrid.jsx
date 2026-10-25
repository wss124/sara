import { useMemo, useState } from 'react';
import { Spin, Tag } from 'antd';
import dayjs from 'dayjs';
import { situacaoDoTurno, SITUACOES_TURNO } from '../../utils/turnos';

const ABERTURA = 7 * 60; // 07:00, em minutos
const FECHAMENTO = 22 * 60; // 22:00
const DURACAO_BLOCO = 30; // minutos

const hora = (d) => d.format('HH:mm');
const emMinutos = (h) => {
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + mm;
};

// Linhas da grade em ordem: cada turno cadastrado e, entre eles, os
// intervalos (horários fora dos turnos, que também podem ser reservados).
// Sem turnos, a grade é uma linha só.
function montarLinhas(turnos) {
  const ordenados = [...turnos].sort((a, b) => emMinutos(a.horaInicio) - emMinutos(b.horaInicio));
  const primeiro = Math.min(ABERTURA, ...ordenados.map((t) => emMinutos(t.horaInicio)));
  const abertura = Math.floor(primeiro / DURACAO_BLOCO) * DURACAO_BLOCO;
  const fechamento = Math.max(FECHAMENTO, ...ordenados.map((t) => emMinutos(t.horaFim)));
  const linhas = [];
  let cursor = abertura;
  for (const turno of ordenados) {
    const de = emMinutos(turno.horaInicio);
    if (cursor < de) linhas.push({ chave: `intervalo-${cursor}`, de: cursor, ate: de });
    linhas.push({ chave: turno.id, turno, de: Math.max(de, cursor), ate: emMinutos(turno.horaFim) });
    cursor = Math.max(cursor, emMinutos(turno.horaFim));
  }
  if (cursor < fechamento) linhas.push({ chave: `intervalo-${cursor}`, de: cursor, ate: fechamento });
  return { linhas, abertura, fechamento };
}

// Monta os blocos de 30 min do dia, marcando os que já passaram ou que
// colidem com alguma reserva aprovada do recurso.
function montarBlocos(data, reservas, abertura, fechamentoMin) {
  const agora = dayjs();
  const blocos = [];
  const meiaNoite = data.startOf('day');
  let inicio = meiaNoite.add(abertura, 'minute');
  const fechamento = meiaNoite.add(fechamentoMin, 'minute');

  while (inicio.isBefore(fechamento)) {
    const fim = inicio.add(DURACAO_BLOCO, 'minute');
    const reservado = reservas.some(
      (r) => dayjs(r.dataInicio).isBefore(fim) && dayjs(r.dataFim).isAfter(inicio)
    );
    blocos.push({ inicio, fim, reservado, passado: inicio.isBefore(agora) });
    inicio = fim;
  }
  return blocos;
}

// Grade de horários clicável: o primeiro clique marca o início e o segundo
// marca o fim. Usada como campo de formulário (value = [início, fim]).
const SEM_TURNOS = [];

function TimeSlotGrid({ data, reservas, turnos = SEM_TURNOS, value, onChange }) {
  const [inicioPendente, setInicioPendente] = useState(null);
  const [hover, setHover] = useState(null);

  const { linhas, abertura, fechamento } = useMemo(() => montarLinhas(turnos), [turnos]);
  const blocos = useMemo(
    () => (data && reservas ? montarBlocos(data, reservas, abertura, fechamento) : []),
    [data, reservas, abertura, fechamento]
  );

  if (!data) {
    return <div className="slots-empty">Escolha o recurso e a data para ver os horários.</div>;
  }
  if (!reservas) {
    return (
      <div className="slots-empty">
        <Spin size="small" />
      </div>
    );
  }

  const indice = (d) => blocos.findIndex((b) => b.inicio.isSame(d));
  const livre = (b) => !b.reservado && !b.passado;
  const intervaloLivre = (de, ate) => blocos.slice(de, ate + 1).every(livre);

  // Faixa destacada: seleção pendente (com prévia no hover) ou valor confirmado
  let faixa = null;
  if (inicioPendente !== null) {
    const ate = hover !== null && hover >= inicioPendente && intervaloLivre(inicioPendente, hover)
      ? hover
      : inicioPendente;
    faixa = [inicioPendente, ate];
  } else if (value) {
    faixa = [indice(value[0]), indice(value[1].subtract(DURACAO_BLOCO, 'minute'))];
  }

  const confirmar = (de, ate) => {
    setInicioPendente(null);
    onChange?.([blocos[de].inicio, blocos[ate].fim]);
  };

  const clicar = (i) => {
    if (!livre(blocos[i])) return;
    if (inicioPendente === null) {
      // Primeiro clique: já vale como reserva de um bloco, caso a pessoa pare aqui
      setInicioPendente(i);
      onChange?.([blocos[i].inicio, blocos[i].fim]);
    } else if (i >= inicioPendente && intervaloLivre(inicioPendente, i)) {
      confirmar(inicioPendente, i);
    } else {
      // Clicou antes do início ou atravessando um horário ocupado: recomeça
      setInicioPendente(i);
      onChange?.([blocos[i].inicio, blocos[i].fim]);
    }
  };

  return (
    <div className="slots">
      {linhas.map((linha) => {
        const minutoDoDia = (d) => d.diff(data.startOf('day'), 'minute');
        const doTurno = blocos
          .map((b, i) => ({ ...b, i }))
          .filter((b) => minutoDoDia(b.inicio) >= linha.de && minutoDoDia(b.inicio) < linha.ate);
        if (doTurno.length === 0) return null;
        const situacao = linha.turno && situacaoDoTurno(data, linha.turno, reservas).situacao;
        return (
          <div className={`slots-turno${linha.turno ? '' : ' is-intervalo'}`} key={linha.chave}>
            <span className="slots-turno-label">
              {linha.turno ? linha.turno.nome : turnos.length > 0 ? 'Intervalo' : 'Horários'}
              {situacao && (
                <Tag color={SITUACOES_TURNO[situacao].color} className="slots-turno-tag">
                  {SITUACOES_TURNO[situacao].label}
                </Tag>
              )}
            </span>
            <div className="slots-grid">
              {doTurno.map((b) => {
                const selecionado = faixa && b.i >= faixa[0] && b.i <= faixa[1];
                const classes = [
                  'slot',
                  b.reservado && 'is-reservado',
                  b.passado && !b.reservado && 'is-passado',
                  selecionado && 'is-selecionado',
                  faixa && b.i === faixa[0] && 'is-inicio',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <button
                    type="button"
                    key={b.i}
                    className={classes}
                    disabled={!livre(b)}
                    title={b.reservado ? 'Já reservado' : b.passado ? 'Horário já passou' : undefined}
                    onClick={() => clicar(b.i)}
                    onMouseEnter={() => setHover(b.i)}
                    onMouseLeave={() => setHover(null)}
                  >
                    {hora(b.inicio)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="slots-footer">
        <div className="slots-legend">
          <span><i className="legend-livre" /> Livre</span>
          <span><i className="legend-reservado" /> Reservado</span>
          <span><i className="legend-selecionado" /> Selecionado</span>
        </div>
        <span className="slots-resumo">
          {value ? (
            <>
              <strong>
                {hora(value[0])} – {hora(value[1])}
              </strong>
              {inicioPendente !== null && ' · clique no horário final'}
            </>
          ) : (
            'Clique no horário de início'
          )}
        </span>
      </div>
    </div>
  );
}

export default TimeSlotGrid;
