import { useState } from 'react';
import { Modal, Input, message } from 'antd';
import { recusarSolicitacao } from '../../services/solicitacaoService';
import { periodoDaSolicitacao } from '../../utils/format';

const MOTIVO_PADRAO = 'O horário foi concedido a outro pedido.';

// Depois de aprovar um pedido, lista os pedidos pendentes que disputavam o
// mesmo horário. A decisão é do admin: recusar todos agora (com motivo) ou
// deixá-los pendentes. O pai troca a key a cada aprovação para o motivo
// voltar ao padrão.
function SemVagaModal({ pedidos, onClose }) {
  const [motivo, setMotivo] = useState(MOTIVO_PADRAO);
  const [recusando, setRecusando] = useState(false);

  const recusarTodos = async () => {
    setRecusando(true);
    const resultados = await Promise.allSettled(
      pedidos.map((p) => recusarSolicitacao(p.id, motivo.trim() || undefined))
    );
    setRecusando(false);
    const falhas = resultados.filter((r) => r.status === 'rejected').length;
    if (falhas > 0) message.error(`${falhas} pedido(s) não puderam ser recusados.`);
    else message.success(`${pedidos.length} pedido(s) recusado(s) e professores avisados.`);
    onClose(true);
  };

  return (
    <Modal
      title={`${pedidos.length} pedido(s) ficaram sem vaga`}
      open={pedidos.length > 0}
      onOk={recusarTodos}
      onCancel={() => onClose(false)}
      okText="Recusar todos"
      cancelText="Deixar pendentes"
      okButtonProps={{ danger: true }}
      confirmLoading={recusando}
    >
      <p>Estes pedidos disputavam o horário que você acabou de aprovar:</p>
      <ul className="sem-vaga-lista">
        {pedidos.map((p) => (
          <li key={p.id}>
            <strong>{p.usuario.nome}</strong> · {periodoDaSolicitacao(p)}
          </li>
        ))}
      </ul>
      <p>Motivo enviado aos professores:</p>
      <Input.TextArea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
    </Modal>
  );
}

export default SemVagaModal;
