import { useEffect, useState } from 'react';
import { Modal, Form, Select, DatePicker, TimePicker, Input, message } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { listarRecursos } from '../../services/recursoService';
import { consultarOcupacao, criarSolicitacao } from '../../services/solicitacaoService';

function RequestModal({ open, recursoInicial, onClose, onCreated }) {
  const [form] = Form.useForm();
  const [recursos, setRecursos] = useState([]);
  const [reservas, setReservas] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const recursoId = Form.useWatch('recursoId', form);
  const data = Form.useWatch('data', form);

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ recursoId: recursoInicial });
    listarRecursos()
      .then((lista) => setRecursos(lista.filter((r) => r.ativo)))
      .catch(() => message.error('Erro ao carregar recursos.'));
  }, [open, recursoInicial, form]);

  // Busca as reservas aprovadas do recurso no dia escolhido
  useEffect(() => {
    if (!recursoId || !data) return;
    let cancelado = false;
    consultarOcupacao(
      recursoId,
      data.startOf('day').toISOString(),
      data.endOf('day').toISOString()
    )
      .then((lista) => !cancelado && setReservas(lista))
      .catch(() => !cancelado && setReservas(null));
    return () => {
      cancelado = true;
    };
  }, [recursoId, data]);

  const salvar = async () => {
    const valores = await form.validateFields();
    const [horaInicio, horaFim] = valores.horario;
    const juntar = (hora) =>
      valores.data.hour(hora.hour()).minute(hora.minute()).second(0).millisecond(0);

    setSalvando(true);
    try {
      await criarSolicitacao({
        recursoId: valores.recursoId,
        dataInicio: juntar(horaInicio).toISOString(),
        dataFim: juntar(horaFim).toISOString(),
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

  const mostrarReservas = recursoId && data && reservas;

  return (
    <Modal
      title="Nova solicitação"
      open={open}
      onCancel={onClose}
      onOk={salvar}
      okText="Enviar solicitação"
      cancelText="Cancelar"
      confirmLoading={salvando}
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

        {mostrarReservas && (
          <div className="request-occupancy">
            <CalendarOutlined />
            {reservas.length === 0 ? (
              <span>Nenhuma reserva aprovada neste dia.</span>
            ) : (
              <span>
                Já reservado:{' '}
                {reservas
                  .map((r) => `${dayjs(r.dataInicio).format('HH:mm')}–${dayjs(r.dataFim).format('HH:mm')}`)
                  .join(', ')}
              </span>
            )}
          </div>
        )}

        <Form.Item
          name="horario"
          label="Horário"
          rules={[
            { required: true, message: 'Informe o horário de início e fim.' },
            {
              validator: (_, valor) =>
                !valor || valor[1].isAfter(valor[0])
                  ? Promise.resolve()
                  : Promise.reject(new Error('O fim deve ser depois do início.')),
            },
          ]}
        >
          <TimePicker.RangePicker
            format="HH:mm"
            minuteStep={15}
            style={{ width: '100%' }}
            placeholder={['Início', 'Fim']}
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
