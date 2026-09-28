import { useEffect, useState } from 'react';
import { Button, Segmented, Popconfirm, Empty, Spin, message } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import {
  listarSolicitacoes,
  aprovarSolicitacao,
  recusarSolicitacao,
} from '../../services/solicitacaoService';
import { formatarPeriodo } from '../../utils/format';
import { STATUS, ICONES_TIPO } from '../Requests/constants';
import '../Requests/Requests.css';

const PERFIS = { ALUNO: 'Aluno', PROFESSOR: 'Professor', ADMIN: 'Administrador' };

function Approvals() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('PENDENTE');
  const [processando, setProcessando] = useState(null);

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
        await recusarSolicitacao(id);
        message.success('Solicitação recusada.');
      }
      carregar(status);
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao processar solicitação.');
    } finally {
      setProcessando(null);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Aprovações</h1>
          <p>Analise as solicitações de reserva enviadas pela comunidade acadêmica.</p>
        </div>
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
          { label: 'Recusadas', value: 'RECUSADA' },
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
                <span className="request-meta">
                  Solicitado por {s.usuario.nome} ({PERFIS[s.usuario.perfil]}) · {s.usuario.email}
                </span>
                {s.observacao && <p>{s.observacao}</p>}
                {s.aprovadoPor && s.status !== 'PENDENTE' && (
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
                      okText="Recusar"
                      cancelText="Voltar"
                      okButtonProps={{ danger: true }}
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
                  <span className={`request-status ${STATUS[s.status].className}`}>
                    {STATUS[s.status].label}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Approvals;
