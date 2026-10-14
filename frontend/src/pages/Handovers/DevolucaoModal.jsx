import { useEffect, useState } from 'react';
import { Modal, Form, Radio, Input, message } from 'antd';
import { registrarDevolucao } from '../../services/solicitacaoService';

const CONDICOES = [
  { value: 'OK', label: 'Tudo certo' },
  { value: 'INCOMPLETO', label: 'Voltou faltando algum item' },
  { value: 'COM_DEFEITO', label: 'Voltou com defeito (vai para manutenção)' },
];

// Devolução no balcão: o admin informa como o recurso voltou
function DevolucaoModal({ reserva, onClose, onDone }) {
  const [form] = Form.useForm();
  const [salvando, setSalvando] = useState(false);
  const condicao = Form.useWatch('condicao', form);

  useEffect(() => {
    form.setFieldsValue({ condicao: 'OK', observacao: '' });
  }, [reserva, form]);

  const salvar = async () => {
    const valores = await form.validateFields();
    setSalvando(true);
    try {
      const resultado = await registrarDevolucao(reserva.id, valores);
      message.success(`${reserva.recurso.nome} devolvido.`);
      onDone(resultado);
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao registrar a devolução.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open
      title={`Devolução · ${reserva.recurso.nome}`}
      onCancel={onClose}
      onOk={salvar}
      okText="Registrar devolução"
      cancelText="Voltar"
      confirmLoading={salvando}
      forceRender
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item name="condicao" label="Como o recurso voltou?">
          <Radio.Group
            options={CONDICOES}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          />
        </Form.Item>
        <Form.Item
          name="observacao"
          label={condicao === 'OK' ? 'Observação (opcional)' : 'O que aconteceu?'}
          rules={
            condicao === 'OK'
              ? []
              : [{ required: true, whitespace: true, message: 'Descreva o problema.' }]
          }
        >
          <Input.TextArea
            rows={3}
            placeholder={
              condicao === 'COM_DEFEITO'
                ? 'Ex.: lâmpada do projetor queimada'
                : 'Ex.: faltou o controle remoto'
            }
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default DevolucaoModal;
