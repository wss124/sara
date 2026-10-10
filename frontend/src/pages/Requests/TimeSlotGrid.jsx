import { useMemo, useState } from 'react';
import { Spin } from 'antd';
import dayjs from 'dayjs';

const ABERTURA = 7; // 07:00
const FECHAMENTO = 22; // 22:00
const DURACAO_BLOCO = 30; // minutos

const TURNOS = [
  { label: 'Manhã', de: ABERTURA, ate: 12 },
  { label: 'Tarde', de: 12, ate: 18 },
  { label: 'Noite', de: 18, ate: FECHAMENTO },
];

const hora = (d) => d.format('HH:mm');

// Monta os blocos de 30 min do dia, marcando os que já passaram ou que
// colidem com alguma reserva aprovada do recurso.
function montarBlocos(data, reservas) {
  const agora = dayjs();
  const blocos = [];
  let inicio = data.hour(ABERTURA).minute(0).second(0).millisecond(0);
  const fechamento = data.hour(FECHAMENTO).minute(0).second(0).millisecond(0);

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
function TimeSlotGrid({ data, reservas, value, onChange }) {
  const [inicioPendente, setInicioPendente] = useState(null);
  const [hover, setHover] = useState(null);

  const blocos = useMemo(
    () => (data && reservas ? montarBlocos(data, reservas) : []),
    [data, reservas]
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
      {TURNOS.map((turno) => {
        const doTurno = blocos
          .map((b, i) => ({ ...b, i }))
          .filter((b) => b.inicio.hour() >= turno.de && b.inicio.hour() < turno.ate);
        return (
          <div className="slots-turno" key={turno.label}>
            <span className="slots-turno-label">{turno.label}</span>
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
