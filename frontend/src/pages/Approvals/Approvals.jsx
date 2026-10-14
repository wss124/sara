import { useEffect, useState } from 'react';
import { Button, Segmented, Popconfirm, Empty, Spin, Input, message } from 'antd';
import dayjs from 'dayjs';
import { CheckOutlined, CloseOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  listarSolicitacoes,
  aprovarSolicitacao,
  recusarSolicitacao,
  cancelarReserva,
} from '../../services/solicitacaoService';
import RequestModal from '../Requests/RequestModal';
import { formatarPeriodo, descreverAcessorios } from '../../utils/format';
import { STATUS, ICONES_TIPO } from '../Requests/constants';
import '../Requests/Requests.css';

const PERFIS = { PROFESSOR: 'Professor', ADMIN: 'Administrador' };

function Approvals() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('PENDENTE');
  const [processando, setProcessando] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');

  const carregar = (filtro) =>
    listarSolicitacoes(filtro === 'TODAS' ? undefined : filtro)
      .then(setSolicitacoes)
      .catch((error) =>
        message.error(error.response?.data?.error || 'Erro ao carregar solicitações.')
      )
      .finally(() => setLoading(false));

  useEffect(() => {
    carregar(status);
  }, [status]);

  const decidir = async (id, acao) => {
    setProcessando(id);
    try {
      if (acao === 'aprovar') {
        await aprovarSolicitacao(id);
        message.success('Solicitação aprovada.');
      } else {
        await recusarSolicitacao(id, motivoRecusa.trim() || undefined);
        message.success('Solicitação recusada.');
      }
      carregar(status);
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao processar solicitação.');
    } finally {
      setProcessando(null);
    }
  };

  const desfazerReserva = async (id) => {
    setProcessando(id);
    try {
      await cancelarReserva(id);
      message.success('Reserva cancelada.');
      carregar(status);
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao cancelar reserva.');
    } finally {
      setProcessando(null);
    }
  };

  // Quem pediu ou, nas reservas lançadas pelo admin, para quem foi registrada
  const descreverOrigem = (s) => {
    if (s.institucional) return `Uso institucional · registrado por ${s.lancadoPor?.nome}`;
    const usuario = `${s.usuario.nome} (${PERFIS[s.usuario.perfil]}) · ${s.usuario.email}`;
    return s.lancadoPor
      ? `Reservado para ${usuario} · registrado por ${s.lancadoPor.nome}`
      : `Solicitado por ${usuario}`;
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Aprovações</h1>
          <p>Analise as solicitações da comunidade acadêmica ou registre reservas diretamente.</p>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          className="page-primary-button"
          onClick={() => setModalAberto(true)}
        >
          Nova reserva
        </Button>
      </header>

      <Segmented
        size="large"
        className="page-segmented"
        value={status}
        onChange={(valor) => {
          setLoading(true);
          setStatus(valor);
        }}
        options={[
          { label: 'Pendentes', value: 'PENDENTE' },
          { label: 'Aprovadas', value: 'APROVADA' },
          { label: 'Em uso', value: 'EM_ANDAMENTO' },
          { label: 'Concluídas', value: 'CONCLUIDA' },
          { label: 'Recusadas', value: 'RECUSADA' },
          { label: 'Canceladas', value: 'CANCELADA' },
          { label: 'Todas', value: 'TODAS' },
        ]}
      />

      {loading ? (
        <div className="page-box">
          <Spin size="large" />
        </div>
      ) : solicitacoes.length === 0 ? (
        <div className="page-box">
          <Empty
            description={
              status === 'PENDENTE'
                ? 'Nenhuma solicitação aguardando aprovação.'
                : 'Nenhuma solicitação encontrada.'
            }
          />
        </div>
      ) : (
        <div className="request-list">
          {solicitacoes.map((s) => (
            <div className="request-item" key={s.id}>
              <div className="request-icon">{ICONES_TIPO[s.recurso.tipo]}</div>

              <div className="request-info">
                <h3>{s.recurso.nome}</h3>
                <span className="request-period">{formatarPeriodo(s.dataInicio, s.dataFim)}</span>
                <span className="request-meta">{descreverOrigem(s)}</span>
                {s.acessorios?.length > 0 && (
                  <span className="request-acessorios">
                    Acompanha: {descreverAcessorios(s.acessorios, Boolean(s.retiradoEm))}
                  </span>
                )}
                {s.observacao && <p>{s.observacao}</p>}
                {s.motivoRecusa && <span className="request-meta">Motivo da recusa: {s.motivoRecusa}</span>}
                {s.motivoCancelamento && (
                  <span className="request-meta">Motivo do cancelamento: {s.motivoCancelamento}</span>
                )}
                {s.aprovadoPor && s.status !== 'PENDENTE' && !s.lancadoPor && (
                  <span className="request-meta">
                    {s.status === 'APROVADA' ? 'Aprovada' : 'Recusada'} por {s.aprovadoPor.nome}
                  </span>
                )}
              </div>

              <div className="request-side">
                {s.status === 'PENDENTE' ? (
                  <div className="request-actions">
                    <Popconfirm
                      title="Recusar solicitação?"
                      description={
                        <Input.TextArea
                          rows={2}
                          value={motivoRecusa}
                          onChange={(e) => setMotivoRecusa(e.target.value)}
                          placeholder="Motivo (opcional, enviado ao professor)"
                          style={{ width: 280, marginTop: 4 }}
                        />
                      }
                      okText="Recusar"
                      cancelText="Voltar"
                      okButtonProps={{ danger: true }}
                      onOpenChange={(aberto) => aberto && setMotivoRecusa('')}
                      onConfirm={() => decidir(s.id, 'recusar')}
                    >
                      <Button danger icon={<CloseOutlined />} disabled={processando === s.id}>
                        Recusar
                      </Button>
                    </Popconfirm>
                    <Button
                      type="primary"
                      icon={<CheckOutlined />}
                      className="page-primary-button"
                      loading={processando === s.id}
                      onClick={() => decidir(s.id, 'aprovar')}
                    >
                      Aprovar
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className={`request-status ${STATUS[s.status].className}`}>
                      {s.lancadoPor ? 'Reserva do admin' : STATUS[s.status].label}
                    </span>
                    {s.lancadoPor && s.status === 'APROVADA' && dayjs().isBefore(s.dataFim) && (
                      <Popconfirm
                        title="Cancelar esta reserva?"
                        description="O horário volta a ficar livre."
                        okText="Cancelar reserva"
                        cancelText="Voltar"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => desfazerReserva(s.id)}
                      >
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          loading={processando === s.id}
                        >
                          Cancelar
                        </Button>
                      </Popconfirm>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <RequestModal
        admin
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        onCreated={() => {
          setModalAberto(false);
          setLoading(true);
          setStatus('APROVADA');
          carregar('APROVADA');
        }}
      />
    </div>
  );
}

export default Approvals;
