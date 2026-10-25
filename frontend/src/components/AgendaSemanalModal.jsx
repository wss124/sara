import { useEffect, useState } from 'react';
import { Modal, Button, Spin, Tooltip, Alert, message } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { consultarDisponibilidade } from '../services/recursoService';
import { SITUACOES_TURNO } from '../utils/turnos';
import { ESTADOS_RECURSO, recursoBloqueado } from '../utils/estadoRecurso';
import './AgendaSemanalModal.css';

const DIAS = 7;
const hora = (d) => dayjs(d).format('HH:mm');

// Visão semanal de um recurso: turnos nas linhas, dias nas colunas. Ajuda o
// professor a planejar; com `onEscolher`, clicar num turno livre leva ao pedido.
function AgendaSemanalModal({ recurso, onClose, onEscolher }) {
  const hoje = dayjs().format('YYYY-MM-DD');
  const [inicio, setInicio] = useState(hoje);
  const [resultado, setResultado] = useState({ chave: null, dados: null });

  const chave = recurso ? `${recurso.id}-${inicio}` : null;
  const dados = resultado.chave === chave ? resultado.dados : null;

  useEffect(() => {
    if (!chave) return;
    let cancelado = false;
    consultarDisponibilidade(recurso.id, inicio, DIAS)
      .then((d) => !cancelado && setResultado({ chave, dados: d }))
      .catch(() => !cancelado && message.error('Erro ao carregar a agenda do recurso.'));
    return () => {
      cancelado = true;
    };
  }, [chave, recurso, inicio]);

  const mover = (dias) => setInicio(dayjs(inicio).add(dias, 'day').format('YYYY-MM-DD'));
  const fim = dayjs(inicio).add(DIAS - 1, 'day');
  const bloqueado = dados && recursoBloqueado(dados.recurso);

  return (
    <Modal
      title={recurso ? `Agenda de ${recurso.nome}` : ''}
      open={Boolean(recurso)}
      onCancel={onClose}
      footer={null}
      width={860}
    >
      <div className="agenda-semana-nav">
        <Button icon={<LeftOutlined />} disabled={inicio <= hoje} onClick={() => mover(-DIAS)} aria-label="Semana anterior" />
        <strong>
          {dayjs(inicio).format('DD/MM')} – {fim.format('DD/MM/YYYY')}
        </strong>
        <Button icon={<RightOutlined />} onClick={() => mover(DIAS)} aria-label="Próxima semana" />
        {inicio !== hoje && (
          <Button type="link" onClick={() => setInicio(hoje)}>
            Voltar para hoje
          </Button>
        )}
      </div>

      {bloqueado && (
        <Alert
          type="warning"
          showIcon
          className="agenda-semana-alerta"
          title={`${ESTADOS_RECURSO[dados.recurso.estado].label}: o recurso não aceita pedidos no momento.`}
        />
      )}

      {!dados ? (
        <div className="agenda-semana-vazia">
          <Spin />
        </div>
      ) : dados.turnos.length === 0 ? (
        <div className="agenda-semana-vazia">Nenhum turno cadastrado.</div>
      ) : (
        <div className="agenda-semana-scroll">
          <table className="agenda-semana">
            <thead>
              <tr>
                <th />
                {dados.dias.map((d) => (
                  <th key={d.data} className={d.data === hoje ? 'is-hoje' : ''}>
                    <span>{dayjs(d.data).format('ddd')}</span>
                    {dayjs(d.data).format('DD/MM')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dados.turnos.map((turno, linha) => (
                <tr key={turno.id}>
                  <th scope="row">
                    {turno.nome}
                    <span>
                      {turno.horaInicio}–{turno.horaFim}
                    </span>
                  </th>
                  {dados.dias.map((d) => {
                    const celula = d.turnos[linha];
                    const situacao = SITUACOES_TURNO[celula.situacao];
                    const clicavel = onEscolher && celula.situacao === 'LIVRE' && !bloqueado;
                    const detalhes = [
                      ...celula.ocupados.map((o) => `Reservado ${hora(o.inicio)}–${hora(o.fim)}`),
                      ...(celula.pendentes > 0 ? [`${celula.pendentes} pedido(s) em análise`] : []),
                      ...(clicavel ? ['Clique para solicitar este turno'] : []),
                    ];
                    return (
                      <td key={d.data}>
                        <Tooltip title={detalhes.length ? detalhes.join(' · ') : null}>
                          <button
                            type="button"
                            className={`agenda-semana-celula is-${celula.situacao.toLowerCase()}${
                              clicavel ? ' is-clicavel' : ''
                            }`}
                            aria-disabled={!clicavel}
                            onClick={() => clicavel && onEscolher({ data: d.data, turnoId: turno.id })}
                          >
                            {situacao.label}
                            {celula.pendentes > 0 && <small>{celula.pendentes} em análise</small>}
                          </button>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

export default AgendaSemanalModal;
