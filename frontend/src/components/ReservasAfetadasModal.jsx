import { useState } from 'react';
import { Modal, Input, Button, Empty, message } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { cancelarPeloAdmin } from '../services/solicitacaoService';
import { periodoDaSolicitacao, responsavelPela } from '../utils/format';

const MOTIVO_PADRAO = 'O recurso precisou ir para manutenção.';

// Mostrado quando um recurso sai de uso (manutenção ou indisponível) e ainda
// tem reservas aprovadas pela frente: o admin cancela as que não dá para
// atender, e o professor vê o motivo em "Minhas solicitações".
function ReservasAfetadasModal({ recurso, reservas, onClose }) {
  const [motivo, setMotivo] = useState(MOTIVO_PADRAO);
  const [canceladas, setCanceladas] = useState([]);
  const [processando, setProcessando] = useState(null);

  const pendentes = reservas.filter((r) => !canceladas.includes(r.id));

  const cancelar = async (reserva) => {
    if (!motivo.trim()) {
      message.error('Informe o motivo do cancelamento.');
      return;
    }
    setProcessando(reserva.id);
    try {
      await cancelarPeloAdmin(reserva.id, motivo.trim());
      setCanceladas((atual) => [...atual, reserva.id]);
      message.success('Reserva cancelada.');
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao cancelar a reserva.');
    } finally {
      setProcessando(null);
    }
  };

  return (
    <Modal
      open
      title={`Reservas futuras de ${recurso}`}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Fechar</Button>}
      width={640}
    >
      <p>
        Estas reservas aprovadas ainda vão acontecer. Cancele as que não poderão ser atendidas
        ou mantenha-as se o recurso voltar a tempo.
      </p>
      <Input.TextArea
        rows={2}
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo mostrado ao professor"
        style={{ marginBottom: 12 }}
      />
      {pendentes.length === 0 ? (
        <Empty description="Nenhuma reserva pendente de decisão." />
      ) : (
        <div className="request-list">
          {pendentes.map((r) => (
            <div className="request-item" key={r.id}>
              <div className="request-info">
                <span className="request-period">{periodoDaSolicitacao(r)}</span>
                <span className="request-meta">{responsavelPela(r)}</span>
              </div>
              <Button
                danger
                icon={<CloseOutlined />}
                loading={processando === r.id}
                onClick={() => cancelar(r)}
              >
                Cancelar
              </Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default ReservasAfetadasModal;
