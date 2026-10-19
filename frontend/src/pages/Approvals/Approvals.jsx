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
import SemVagaModal from './SemVagaModal';
import { periodoDaSolicitacao, descreverAcessorios } from '../../utils/format';
import { STATUS, ICONES_TIPO } from '../Requests/constants';
import '../Requests/Requests.css';

const PERFIS = { PROFESSOR: 'Professor', ADMIN: 'Administrador' };

const quando = (data) => dayjs(data).format('DD/MM [às] HH:mm');

// Junta os pedidos pendentes que disputam o mesmo horário (direta ou
// indiretamente) num bloco, em ordem de chegada. Os demais ficam sozinhos.
// A ordem dos blocos segue a da lista recebida.
function agruparDisputas(lista) {
  const porId = new Map(lista.map((s) => [s.id, s]));
  const grupoDe = new Map();
  const blocos = [];
  for (const s of lista) {
    if (grupoDe.has(s.id)) continue;
    const bloco = [];
    const pendentes = [s];
    grupoDe.set(s.id, bloco);
    while (pendentes.length > 0) {
      const atual = pendentes.pop();
      bloco.push(atual);
      for (const c of atual.fila?.concorrentes ?? []) {
        const outro = porId.get(c.id);
        if (outro && !grupoDe.has(outro.id)) {
          grupoDe.set(outro.id, bloco);
          pendentes.push(outro);
        }
      }
    }
    bloco.sort((a, b) => dayjs(a.criadoEm) - dayjs(b.criadoEm));
    blocos.push(bloco);
  }
  return blocos;
}

function Approvals() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('PENDENTE');
  const [processando, setProcessando] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  // Pedidos que perderam a vaga na última aprovação
  const [semVaga, setSemVaga] = useState([]);

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
        const aprovada = await aprovarSolicitacao(id);
        message.success('Solicitação aprovada.');
        setSemVaga(aprovada.semVaga ?? []);
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

  // Um pedido da lista, com as ações conforme o status
  function renderItem(s) {
    return (
      <div className="request-item" key={s.id}>
        <div className="request-icon">{ICONES_TIPO[s.recurso.tipo]}</div>

        <div className="request-info">
          <h3>{s.recurso.nome}</h3>
          <span className="request-period">{periodoDaSolicitacao(s)}</span>
          <span className="request-meta">{descreverOrigem(s)}</span>
          {s.fila && (
            <span className="request-fila">
              {s.fila.posicao}º na fila de {s.fila.total} · pedido em {quando(s.criadoEm)}
            </span>
          )}
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
              {s.fila?.posicao > 1 ? (
                // Aprovar fora da ordem de chegada é permitido, mas pede confirmação
                <Popconfirm
                  title="Há pedidos anteriores para este horário"
                  description={
                    <ul className="sem-vaga-lista">
                      {s.fila.concorrentes
                        .filter((c) => dayjs(c.criadoEm).isBefore(s.criadoEm))
                        .map((c) => (
                          <li key={c.id}>
                            {c.usuario.nome}, pedido em {quando(c.criadoEm)}
                          </li>
                        ))}
                    </ul>
                  }
                  okText="Aprovar este mesmo assim"
                  cancelText="Voltar"
                  onConfirm={() => decidir(s.id, 'aprovar')}
                >
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    className="page-primary-button"
                    loading={processando === s.id}
                  >
                    Aprovar
                  </Button>
                </Popconfirm>
              ) : (
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  className="page-primary-button"
                  loading={processando === s.id}
                  onClick={() => decidir(s.id, 'aprovar')}
                >
                  Aprovar
                </Button>
              )}
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
    );
  }

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
          {agruparDisputas(solicitacoes).map((bloco) =>
            bloco.length > 1 ? (
              <section className="disputa" key={bloco[0].id}>
                <header className="disputa-header">
                  <strong>{bloco.length} pedidos disputam o mesmo horário</strong>
                  <span>
                    Em ordem de chegada. Aprovar um deixa os outros sem vaga; a escolha é sua.
                  </span>
                </header>
                {bloco.map(renderItem)}
              </section>
            ) : (
              renderItem(bloco[0])
            )
          )}
        </div>
      )}

      <SemVagaModal
        key={semVaga.map((p) => p.id).join()}
        pedidos={semVaga}
        onClose={(recusou) => {
          setSemVaga([]);
          if (recusou) carregar(status);
        }}
      />

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
