import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  TimePicker,
  Switch,
  Popconfirm,
  Tooltip,
  Alert,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { listarTurnos, criarTurno, atualizarTurno, removerTurno } from '../../services/turnoService';
import '../Requests/Requests.css';

const FORMATO = 'HH:mm';

// Admin: horários dos turnos de aula, usados para reservar um turno inteiro
function Shifts() {
  const [turnos, setTurnos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();

  const carregar = () =>
    listarTurnos()
      .then(setTurnos)
      .catch((error) => message.error(error.response?.data?.error || 'Erro ao carregar turnos.'))
      .finally(() => setLoading(false));

  useEffect(() => {
    carregar();
  }, []);

  const abrirModal = (turno = null) => {
    setEditando(turno);
    form.setFieldsValue(
      turno
        ? {
            nome: turno.nome,
            horario: [dayjs(turno.horaInicio, FORMATO), dayjs(turno.horaFim, FORMATO)],
            ordem: turno.ordem,
          }
        : { nome: '', horario: null, ordem: turnos.length + 1 }
    );
    setModalAberto(true);
  };

  const salvar = async () => {
    const { nome, horario, ordem } = await form.validateFields();
    const dados = {
      nome,
      ordem,
      horaInicio: horario[0].format(FORMATO),
      horaFim: horario[1].format(FORMATO),
    };
    setSalvando(true);
    try {
      if (editando) await atualizarTurno(editando.id, dados);
      else await criarTurno(dados);
      message.success(editando ? 'Turno atualizado.' : 'Turno cadastrado.');
      setModalAberto(false);
      carregar();
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao salvar turno.');
    } finally {
      setSalvando(false);
    }
  };

  const executar = async (acao, sucesso) => {
    try {
      await acao();
      if (sucesso) message.success(sucesso);
      carregar();
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao atualizar turno.');
    }
  };

  const colunas = [
    { title: 'Ordem', dataIndex: 'ordem', width: 80, align: 'center' },
    { title: 'Turno', dataIndex: 'nome', render: (nome) => <strong>{nome}</strong> },
    {
      title: 'Horário',
      key: 'horario',
      render: (_, t) => `${t.horaInicio} – ${t.horaFim}`,
    },
    {
      title: 'Ativo',
      dataIndex: 'ativo',
      width: 80,
      render: (ativo, t) => (
        <Switch
          size="small"
          checked={ativo}
          onChange={() => executar(() => atualizarTurno(t.id, { ativo: !ativo }))}
        />
      ),
    },
    {
      title: '',
      key: 'acoes',
      width: 100,
      render: (_, t) => (
        <>
          <Tooltip title="Editar">
            <Button type="text" icon={<EditOutlined />} onClick={() => abrirModal(t)} />
          </Tooltip>
          <Popconfirm
            title="Excluir turno"
            description="Reservas já feitas neste turno não mudam."
            okText="Excluir"
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
            onConfirm={() => executar(() => removerTurno(t.id), 'Turno excluído.')}
          >
            <Tooltip title="Excluir">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </>
      ),
    },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Turnos</h1>
          <p>Horários de aula do campus. Os professores podem reservar um turno inteiro de uma vez.</p>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          className="page-primary-button"
          onClick={() => abrirModal()}
        >
          Novo turno
        </Button>
      </header>

      <Alert
        type="info"
        showIcon
        title="Alterar o horário de um turno vale para novos pedidos; reservas já feitas mantêm o horário original."
      />

      <Table
        rowKey="id"
        columns={colunas}
        dataSource={turnos}
        loading={loading}
        pagination={false}
        locale={{ emptyText: 'Nenhum turno cadastrado.' }}
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title={editando ? 'Editar turno' : 'Novo turno'}
        open={modalAberto}
        onCancel={() => setModalAberto(false)}
        onOk={salvar}
        okText="Salvar"
        cancelText="Cancelar"
        confirmLoading={salvando}
        forceRender
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="nome"
            label="Nome"
            rules={[{ required: true, whitespace: true, message: 'Informe o nome.' }]}
          >
            <Input placeholder="Ex.: Tarde" />
          </Form.Item>
          <Form.Item
            name="horario"
            label="Horário"
            rules={[{ required: true, message: 'Informe o início e o fim.' }]}
          >
            <TimePicker.RangePicker format={FORMATO} minuteStep={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="ordem" label="Ordem de exibição">
            <InputNumber min={0} precision={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Shifts;
