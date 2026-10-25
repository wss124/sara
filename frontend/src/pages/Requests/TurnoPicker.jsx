import { Spin, Tag } from 'antd';
import dayjs from 'dayjs';
import { CheckCircleFilled } from '@ant-design/icons';
import { situacaoDoTurno, SITUACOES_TURNO } from '../../utils/turnos';

const hora = (d) => dayjs(d).format('HH:mm');

// Campo de formulário para reservar turnos inteiros: cada turno do dia aparece
// com a disponibilidade no recurso, e só os livres podem ser marcados.
// value = ids dos turnos escolhidos.
function TurnoPicker({ data, reservas, turnos, value = [], onChange }) {
  if (!data) {
    return <div className="slots-empty">Escolha o recurso e a data para ver os turnos.</div>;
  }
  if (!reservas) {
    return (
      <div className="slots-empty">
        <Spin size="small" />
      </div>
    );
  }
  if (turnos.length === 0) {
    return <div className="slots-empty">Nenhum turno cadastrado. Use a opção “Por horário”.</div>;
  }

  const alternar = (id) =>
    onChange?.(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="turnos">
      {turnos.map((turno) => {
        const { situacao, inicio, fim, conflitos } = situacaoDoTurno(data, turno, reservas);
        const livre = situacao === 'LIVRE';
        const selecionado = value.includes(turno.id);
        return (
          <button
            type="button"
            key={turno.id}
            className={`turno-opcao${selecionado ? ' is-selecionado' : ''}`}
            disabled={!livre}
            aria-pressed={selecionado}
            onClick={() => alternar(turno.id)}
          >
            <span className="turno-opcao-topo">
              <strong>{turno.nome}</strong>
              {selecionado && <CheckCircleFilled />}
            </span>
            <span className="turno-opcao-horario">
              {hora(inicio)} – {hora(fim)}
            </span>
            <Tag color={SITUACOES_TURNO[situacao].color}>{SITUACOES_TURNO[situacao].label}</Tag>
            {situacao === 'PARCIAL' && (
              <span className="turno-opcao-detalhe">
                Ocupado:{' '}
                {conflitos
                  .map((r) => `${hora(r.dataInicio)}–${hora(r.dataFim)}`)
                  .join(', ')}
                . Reserve os horários livres pela opção “Por horário”.
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default TurnoPicker;
