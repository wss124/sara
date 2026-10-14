import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Segmented, Popconfirm, Empty, Spin, message } from 'antd';
import dayjs from 'dayjs';
import { PlusOutlined, CloseOutlined, EnvironmentOutlined } from '@ant-design/icons';
import {
  listarMinhasSolicitacoes,
  cancelarSolicitacao,
} from '../../services/solicitacaoService';
import { formatarPeriodo, descreverAcessorios } from '../../utils/format';
import RequestModal from './RequestModal';
import { STATUS, ICONES_TIPO } from './constants';
import './Requests.css';

function Requests() {
  const location = useLocation();
  const navigate = useNavigate();

  // Vindo da página de recursos pelo botão "Solicitar", já abre o formulário
  const recursoInicial = location.state?.recursoId;

  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('TODAS');
  const [modalAberto, setModalAberto] = useState(Boolean(recursoInicial));

  const carregar = () =>
    listarMinhasSolicitacoes()
      .then(setSolicitacoes)
      .catch((error) =>
        message.error(error.response?.data?.error || 'Erro ao carregar solicitações.')
      )
      .finally(() => setLoading(false));

  useEffect(() => {
    carregar();
  }, []);

  const filtradas = useMemo(
    () => solicitacoes.filter((s) => filtro === 'TODAS' || s.status === filtro),
    [solicitacoes, filtro]
  );

  const fecharModal = () => {
    setModalAberto(false);
    // Limpa o recurso pré-selecionado para não reabrir ao recarregar a página
    if (recursoInicial) navigate(location.pathname, { replace: true, state: null });
  };

  const cancelar = async (id) => {
    try {
      await cancelarSolicitacao(id);
      message.success('Cancelado.');
      carregar();
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao cancelar solicitação.');
    }
  };

  const contar = (status) => solicitacoes.filter((s) => s.status === status).length;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Minhas solicitações</h1>
          <p>Acompanhe seus pedidos de reserva de salas e equipamentos.</p>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          className="page-primary-button"
          onClick={() => setModalAberto(true)}
        >
          Nova solicitação
        </Button>
      </header>

      <Segmented
        size="large"
        className="page-segmented"
        value={filtro}
        onChange={setFiltro}
        options={[
          { label: `Todas (${solicitacoes.length})`, value: 'TODAS' },
          { label: `Pendentes (${contar('PENDENTE')})`, value: 'PENDENTE' },
          { label: `Aprovadas (${contar('APROVADA')})`, value: 'APROVADA' },
          { label: `Em uso (${contar('EM_ANDAMENTO')})`, value: 'EM_ANDAMENTO' },
          { label: `Concluídas (${contar('CONCLUIDA')})`, value: 'CONCLUIDA' },
          { label: `Recusadas (${contar('RECUSADA')})`, value: 'RECUSADA' },
          { label: `Canceladas (${contar('CANCELADA')})`, value: 'CANCELADA' },
        ]}
      />

      {loading ? (
        <div className="page-box">
          <Spin size="large" />
        </div>
      ) : filtradas.length === 0 ? (
        <div className="page-box">
          <Empty
            description={
              solicitacoes.length === 0
                ? 'Você ainda não fez nenhuma solicitação.'
                : 'Nenhuma solicitação com esse status.'
            }
          />
        </div>
      ) : (
        <div className="request-list">
          {filtradas.map((s) => (
            <div className="request-item" key={s.id}>
              <div className="request-icon">{ICONES_TIPO[s.recurso.tipo]}</div>

              <div className="request-info">
                <h3>{s.recurso.nome}</h3>
                <span className="request-period">{formatarPeriodo(s.dataInicio, s.dataFim)}</span>
                {s.recurso.localizacao && (
                  <span className="request-location">
                    <EnvironmentOutlined /> Retirar em: {s.recurso.localizacao}
                  </span>
                )}
                {s.acessorios?.length > 0 && (
                  <span className="request-acessorios">
                    Acompanha: {descreverAcessorios(s.acessorios, Boolean(s.retiradoEm))}
                  </span>
                )}
                {s.observacao && <p>{s.observacao}</p>}
                {s.motivoCancelamento && (
                  <span className="request-meta">Cancelada pelo administrador: {s.motivoCancelamento}</span>
                )}
                {s.devolvidoEm && (
                  <span className="request-meta">
                    Devolvido em {dayjs(s.devolvidoEm).format('DD/MM HH:mm')}
                    {s.observacaoDevolucao && ` · ${s.observacaoDevolucao}`}
                  </span>
                )}
              </div>

              <div className="request-side">
                <span className={`request-status ${STATUS[s.status].className}`}>
                  {STATUS[s.status].label}
                </span>
                {(s.status === 'PENDENTE' ||
                  (s.status === 'APROVADA' && dayjs().isBefore(s.dataFim))) && (
                  <Popconfirm
                    title={s.status === 'PENDENTE' ? 'Cancelar solicitação?' : 'Cancelar reserva?'}
                    description={
                      s.status === 'APROVADA' ? 'O horário volta a ficar livre para outros professores.' : undefined
                    }
                    okText="Sim, cancelar"
                    cancelText="Não"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => cancelar(s.id)}
                  >
                    <Button type="text" danger size="small" icon={<CloseOutlined />}>
                      Cancelar
                    </Button>
                  </Popconfirm>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <RequestModal
        open={modalAberto}
        recursoInicial={recursoInicial}
        onClose={fecharModal}
        onCreated={() => {
          fecharModal();
          carregar();
        }}
      />
    </div>
  );
}

export default Requests;
