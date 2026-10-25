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
  Card,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { listarTurnos, criarTurno, atualizarTurno, removerTurno } from '../../services/turnoService';
import { obterConfiguracao, atualizarConfiguracao } from '../../services/configuracaoService';
import '../Requests/Requests.css';

const FORMATO = 'HH:mm';

// Antecedência mínima e máxima dos pedidos dos professores. As reservas
// lançadas pelo admin não seguem essas regras.
function PrazosDosPedidos() {
  const [form] = Form.useForm();
  const [carregado, setCarregado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    obterConfiguracao()
      .then((regras) => {
        form.setFieldsValue(regras);
        setCarregado(true);
      })
      .catch((error) => message.error(error.response?.data?.error || 'Erro ao carregar as regras.'));
  }, [form]);

  const salvar = async () => {
    const valores = await form.validateFields();
    setSalvando(true);
    try {
      form.setFieldsValue(await atualizarConfiguracao(valores));
      message.success('Prazos atualizados. Valem para os próximos pedidos.');
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao salvar as regras.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card title="Prazos dos pedidos" loading={!carregado}>
      <p>
        Com quanto tempo de antecedência os professores podem pedir um recurso. Numa série
        semanal, o máximo vale só para o primeiro dia.
      </p>
      <Form form={form} layout="inline" requiredMark={false} onFinish={salvar}>
        <Form.Item
          name="antecedenciaMinHoras"
          label="Pelo menos"
          rules={[{ required: true, message: 'Informe o mínimo.' }]}
        >
          <InputNumber min={0} max={720} precision={0} suffix="horas" style={{ width: 140 }} />
        </Form.Item>
        <Form.Item
          name="antecedenciaMaxDias"
          label="No máximo"
          rules={[{ required: true, message: 'Informe o máximo.' }]}
        >
          <InputNumber min={1} max={365} precision={0} suffix="dias" style={{ width: 140 }} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={salvando}>
            Salvar prazos
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

// Admin: horários dos turnos de aula, usados para reservar um turno inteiro,
// e os prazos de antecedência dos pedidos
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
          <h1>Turnos e prazos</h1>
          <p>
            Horários de aula do campus e com quanta antecedência os professores podem pedir um
            recurso.
          </p>
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

      <PrazosDosPedidos />

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
