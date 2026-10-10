import { useEffect, useState } from 'react';
import { Modal, Form, Select, DatePicker, Input, message } from 'antd';
import dayjs from 'dayjs';
import TimeSlotGrid from './TimeSlotGrid';
import { listarRecursos } from '../../services/recursoService';
import { consultarOcupacao, criarSolicitacao } from '../../services/solicitacaoService';

function RequestModal({ open, recursoInicial, onClose, onCreated }) {
  const [form] = Form.useForm();
  const [recursos, setRecursos] = useState([]);
  // Reservas guardadas junto com a combinação recurso/dia a que pertencem,
  // para não exibir dados de uma consulta anterior enquanto a nova carrega
  const [ocupacao, setOcupacao] = useState({ chave: null, lista: null });
  const [salvando, setSalvando] = useState(false);

  const recursoId = Form.useWatch('recursoId', form);
  const data = Form.useWatch('data', form);
  const chave = recursoId && data ? `${recursoId}-${data.valueOf()}` : null;
  const reservas = chave && ocupacao.chave === chave ? ocupacao.lista : null;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ recursoId: recursoInicial });
    listarRecursos()
      .then((lista) => setRecursos(lista.filter((r) => r.ativo)))
      .catch(() => message.error('Erro ao carregar recursos.'));
  }, [open, recursoInicial, form]);

  // Busca as reservas aprovadas do recurso no dia escolhido. Trocar o recurso
  // ou a data invalida o horário já marcado na grade.
  useEffect(() => {
    form.setFieldValue('horario', undefined);
    if (!chave) return;
    let cancelado = false;
    consultarOcupacao(
      recursoId,
      data.startOf('day').toISOString(),
      data.endOf('day').toISOString()
    )
      .then((lista) => !cancelado && setOcupacao({ chave, lista }))
      .catch(() => !cancelado && message.error('Erro ao consultar os horários ocupados.'));
    return () => {
      cancelado = true;
    };
  }, [chave, recursoId, data, form]);

  const salvar = async () => {
    const valores = await form.validateFields();
    const [inicio, fim] = valores.horario;

    setSalvando(true);
    try {
      await criarSolicitacao({
        recursoId: valores.recursoId,
        dataInicio: inicio.toISOString(),
        dataFim: fim.toISOString(),
        observacao: valores.observacao,
      });
      message.success('Solicitação enviada! Aguarde a aprovação do administrador.');
      onCreated();
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao enviar solicitação.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      title="Nova solicitação"
      open={open}
      onCancel={onClose}
      onOk={salvar}
      okText="Enviar solicitação"
      cancelText="Cancelar"
      confirmLoading={salvando}
      width={720}
      forceRender
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="recursoId"
          label="Recurso"
          rules={[{ required: true, message: 'Escolha um recurso.' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Selecione uma sala ou equipamento"
            options={recursos.map((r) => ({ value: r.id, label: r.nome }))}
          />
        </Form.Item>

        <Form.Item name="data" label="Data" rules={[{ required: true, message: 'Escolha a data.' }]}>
          <DatePicker
            format="DD/MM/YYYY"
            style={{ width: '100%' }}
            disabledDate={(d) => d.isBefore(dayjs(), 'day')}
          />
        </Form.Item>

        <Form.Item
          name="horario"
          label="Horário"
          rules={[{ required: true, message: 'Escolha o horário na grade.' }]}
        >
          <TimeSlotGrid
            key={chave}
            data={chave ? data : null}
            reservas={reservas}
          />
        </Form.Item>

        <Form.Item name="observacao" label="Observação (opcional)">
          <Input.TextArea rows={3} placeholder="Ex.: aula prática da disciplina de Redes" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default RequestModal;
