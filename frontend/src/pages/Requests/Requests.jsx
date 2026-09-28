import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Segmented, Popconfirm, Empty, Spin, message } from 'antd';
import { PlusOutlined, CloseOutlined } from '@ant-design/icons';
import {
  listarMinhasSolicitacoes,
  cancelarSolicitacao,
} from '../../services/solicitacaoService';
import { formatarPeriodo } from '../../utils/format';
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
      message.success('Solicitação cancelada.');
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
          { label: `Recusadas (${contar('RECUSADA')})`, value: 'RECUSADA' },
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
                {s.observacao && <p>{s.observacao}</p>}
              </div>

              <div className="request-side">
                <span className={`request-status ${STATUS[s.status].className}`}>
                  {STATUS[s.status].label}
                </span>
                {s.status === 'PENDENTE' && (
                  <Popconfirm
                    title="Cancelar solicitação?"
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
