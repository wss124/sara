import { useEffect, useState } from 'react';
import { Button, Empty, Spin, Tooltip, message } from 'antd';
import {
  ExportOutlined,
  ImportOutlined,
  EnvironmentOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { carregarMovimentacoes } from '../../services/solicitacaoService';
import DevolucaoModal from './DevolucaoModal';
import RetiradaModal from './RetiradaModal';
import ReservasAfetadasModal from '../../components/ReservasAfetadasModal';
import { formatarPeriodo, responsavelPela, descreverAcessorios } from '../../utils/format';
import { ICONES_TIPO } from '../Requests/constants';
import '../Requests/Requests.css';
import './Handovers.css';

// Mesmo valor padrão do backend (ANTECEDENCIA_RETIRADA_MIN)
const ANTECEDENCIA_RETIRADA_MIN = 60;
const INTERVALO_MS = 30_000;

function hora(data) {
  return dayjs(data).format('HH:mm');
}

function Secao({ titulo, descricao, vazio, itens, renderAcoes, renderDetalhe }) {
  return (
    <section className="handover-section">
      <div className="handover-section-header">
        <h2>
          {titulo} <span className="handover-count">{itens.length}</span>
        </h2>
        <p>{descricao}</p>
      </div>

      {itens.length === 0 ? (
        <div className="page-box">
          <Empty description={vazio} />
        </div>
      ) : (
        <div className="request-list">
          {itens.map((s) => (
            <div className="request-item" key={s.id}>
              <div className="request-icon">{ICONES_TIPO[s.recurso.tipo]}</div>
              <div className="request-info">
                <h3>{s.recurso.nome}</h3>
                <span className="request-period">{formatarPeriodo(s.dataInicio, s.dataFim)}</span>
                <span className="request-meta">{responsavelPela(s)}</span>
                {s.recurso.localizacao && (
                  <span className="request-location">
                    <EnvironmentOutlined /> {s.recurso.localizacao}
                  </span>
                )}
                {s.acessorios?.length > 0 && (
                  <span className="request-acessorios">
                    Acompanha: {descreverAcessorios(s.acessorios, Boolean(s.retiradoEm))}
                  </span>
                )}
                {renderDetalhe?.(s)}
              </div>
              <div className="request-side">{renderAcoes?.(s)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Balcão do admin: entrega os recursos reservados e recebe as devoluções
function Handovers() {
  const [dados, setDados] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [retirando, setRetirando] = useState(null);
  const [devolvendo, setDevolvendo] = useState(null);
  const [afetadas, setAfetadas] = useState(null);

  const carregar = () => {
    setAtualizando(true);
    return carregarMovimentacoes()
      .then(setDados)
      .catch((error) =>
        message.error(error.response?.data?.error || 'Erro ao carregar retiradas e devoluções.')
      )
      .finally(() => setAtualizando(false));
  };

  useEffect(() => {
    carregar();
    const timer = setInterval(carregar, INTERVALO_MS);
    return () => clearInterval(timer);
  }, []);

  if (!dados) {
    return (
      <div className="page-box">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Retiradas e devoluções</h1>
          <p>Registre a entrega dos recursos reservados e o retorno ao fim do uso.</p>
        </div>
        <button type="button" className="handover-refresh" onClick={carregar}>
          <ReloadOutlined spin={atualizando} /> Atualizado às {dayjs(dados.geradoEm).format('HH:mm:ss')}
        </button>
      </header>

      <Secao
        titulo="Aguardando retirada"
        descricao="Reservas aprovadas de hoje que ainda não foram entregues."
        vazio="Nenhuma retirada pendente hoje."
        itens={dados.aguardandoRetirada}
        renderAcoes={(s) => {
          const liberadaEm = dayjs(s.dataInicio).subtract(ANTECEDENCIA_RETIRADA_MIN, 'minute');
          const liberada = dayjs().isAfter(liberadaEm);
          return (
            <Tooltip title={liberada ? '' : `Liberada a partir de ${hora(liberadaEm)}`}>
              <Button
                type="primary"
                icon={<ExportOutlined />}
                className="page-primary-button"
                disabled={!liberada}
                onClick={() => setRetirando(s)}
              >
                Registrar retirada
              </Button>
            </Tooltip>
          );
        }}
      />

      <Secao
        titulo="Em uso"
        descricao="Recursos retirados que ainda não voltaram."
        vazio="Nenhum recurso fora no momento."
        itens={dados.emUso}
        renderDetalhe={(s) => (
          <>
            <span className="request-meta">
              Retirado às {hora(s.retiradoEm)}
              {s.retiradaRegistradaPor && ` por ${s.retiradaRegistradaPor.nome}`}
            </span>
            {s.observacaoRetirada && (
              <span className="request-meta">Na entrega: {s.observacaoRetirada}</span>
            )}
          </>
        )}
        renderAcoes={(s) => (
          <Button icon={<ImportOutlined />} onClick={() => setDevolvendo(s)}>
            Registrar devolução
          </Button>
        )}
      />

      <Secao
        titulo="Devolvidos hoje"
        descricao="Histórico das devoluções registradas hoje."
        vazio="Nenhuma devolução registrada hoje."
        itens={dados.devolvidasHoje}
        renderDetalhe={(s) => (
          <>
            <span className="request-meta">
              Retirado às {hora(s.retiradoEm)} · devolvido às {hora(s.devolvidoEm)}
              {s.devolucaoRegistradaPor && ` (recebido por ${s.devolucaoRegistradaPor.nome})`}
            </span>
            {s.condicaoDevolucao && s.condicaoDevolucao !== 'OK' && (
              <span className={`handover-tag handover-tag-${s.condicaoDevolucao.toLowerCase()}`}>
                {s.condicaoDevolucao === 'COM_DEFEITO' ? 'Com defeito' : 'Incompleto'}
                {s.observacaoDevolucao && ` · ${s.observacaoDevolucao}`}
              </span>
            )}
          </>
        )}
      />

      {retirando && (
        <RetiradaModal
          reserva={retirando}
          onClose={() => setRetirando(null)}
          onDone={() => {
            setRetirando(null);
            carregar();
          }}
        />
      )}
      {devolvendo && (
        <DevolucaoModal
          reserva={devolvendo}
          onClose={() => setDevolvendo(null)}
          onDone={(resultado) => {
            setDevolvendo(null);
            carregar();
            if (resultado.reservasAfetadas?.length) {
              setAfetadas({ recurso: resultado.recurso.nome, reservas: resultado.reservasAfetadas });
            }
          }}
        />
      )}
      {afetadas && (
        <ReservasAfetadasModal
          recurso={afetadas.recurso}
          reservas={afetadas.reservas}
          onClose={() => setAfetadas(null)}
        />
      )}
    </div>
  );
}

export default Handovers;
