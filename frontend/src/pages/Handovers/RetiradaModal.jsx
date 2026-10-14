import { useEffect, useState } from 'react';
import { Modal, Checkbox, Input, message } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import { registrarRetirada } from '../../services/solicitacaoService';

// Entrega no balcão: o admin confere item a item o que sai com o professor.
// Se faltar algo, a entrega só é registrada com uma justificativa.
function RetiradaModal({ reserva, onClose, onDone }) {
  const itens = reserva.acessorios ?? [];
  const [recursoConferido, setRecursoConferido] = useState(false);
  const [conferidos, setConferidos] = useState([]);
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setRecursoConferido(false);
    setConferidos([]);
    setObservacao('');
  }, [reserva]);

  const faltando = itens.filter((i) => !conferidos.includes(i.acessorioId));
  const podeConfirmar = recursoConferido && (faltando.length === 0 || observacao.trim());

  const alternar = (id) =>
    setConferidos((atual) => (atual.includes(id) ? atual.filter((v) => v !== id) : [...atual, id]));

  const salvar = async () => {
    setSalvando(true);
    try {
      await registrarRetirada(reserva.id, { itensConferidos: conferidos, observacao });
      message.success(`${reserva.recurso.nome} entregue.`);
      onDone();
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao registrar a retirada.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open
      title={`Retirada · ${reserva.recurso.nome}`}
      onCancel={onClose}
      onOk={salvar}
      okText="Confirmar entrega"
      cancelText="Voltar"
      okButtonProps={{ disabled: !podeConfirmar }}
      confirmLoading={salvando}
    >
      <p>Confira o que está sendo entregue:</p>
      <ul className="checklist">
        <li>
          <Checkbox checked={recursoConferido} onChange={() => setRecursoConferido((v) => !v)}>
            <strong>{reserva.recurso.nome}</strong>
          </Checkbox>
          {reserva.recurso.localizacao && (
            <span className="checklist-local">
              <EnvironmentOutlined /> {reserva.recurso.localizacao}
            </span>
          )}
        </li>
        {itens.map((i) => (
          <li key={i.acessorioId}>
            <Checkbox
              checked={conferidos.includes(i.acessorioId)}
              onChange={() => alternar(i.acessorioId)}
            >
              {i.acessorio.nome}
              {i.quantidade > 1 && ` (${i.quantidade})`}
            </Checkbox>
            {i.acessorio.localizacao && (
              <span className="checklist-local">
                <EnvironmentOutlined /> {i.acessorio.localizacao}
              </span>
            )}
          </li>
        ))}
      </ul>

      {faltando.length > 0 && (
        <Input.TextArea
          rows={2}
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          placeholder="Por que algum item não está sendo entregue?"
        />
      )}
    </Modal>
  );
}

export default RetiradaModal;
