import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Input,
  Segmented,
  Button,
  Modal,
  Form,
  Select,
  Switch,
  Popconfirm,
  Empty,
  Spin,
  Tooltip,
  message,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  BankOutlined,
  LaptopOutlined,
  EditOutlined,
  DeleteOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import {
  listarRecursos,
  criarRecurso,
  atualizarRecurso,
  removerRecurso,
} from '../../services/recursoService';
import './Resources.css';

const TIPOS = {
  SALA: { label: 'Sala', icon: <BankOutlined /> },
  EQUIPAMENTO: { label: 'Equipamento', icon: <LaptopOutlined /> },
};

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('sara_user'));
  } catch {
    return null;
  }
}

function getStatus(recurso) {
  if (!recurso.ativo) return { label: 'Inativo', className: 'status-inativo' };
  if (recurso.ocupadoAgora) return { label: 'Em uso agora', className: 'status-ocupado' };
  return { label: 'Disponível agora', className: 'status-livre' };
}

function Resources() {
  const isAdmin = getUser()?.perfil === 'ADMIN';
  const navigate = useNavigate();

  const [recursos, setRecursos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState('TODOS');

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();

  const carregar = () =>
    listarRecursos()
      .then(setRecursos)
      .catch((error) =>
        message.error(error.response?.data?.error || 'Erro ao carregar recursos.')
      )
      .finally(() => setLoading(false));

  useEffect(() => {
    carregar();
  }, []);

  // Filtro local por nome/descrição e tipo
  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return recursos.filter(
      (r) =>
        (tipo === 'TODOS' || r.tipo === tipo) &&
        (!termo ||
          r.nome.toLowerCase().includes(termo) ||
          r.descricao?.toLowerCase().includes(termo))
    );
  }, [recursos, busca, tipo]);

  const ativos = recursos.filter((r) => r.ativo);
  const resumo = [
    { label: 'Total de recursos', value: ativos.length },
    { label: 'Disponíveis agora', value: ativos.filter((r) => !r.ocupadoAgora).length },
    { label: 'Em uso agora', value: ativos.filter((r) => r.ocupadoAgora).length },
  ];

  const abrirModal = (recurso = null) => {
    setEditando(recurso);
    form.setFieldsValue(
      recurso
        ? { nome: recurso.nome, tipo: recurso.tipo, descricao: recurso.descricao }
        : { nome: '', tipo: 'SALA', descricao: '' }
    );
    setModalAberto(true);
  };

  const salvar = async () => {
    const valores = await form.validateFields();
    setSalvando(true);
    try {
      if (editando) {
        await atualizarRecurso(editando.id, valores);
        message.success('Recurso atualizado.');
      } else {
        await criarRecurso(valores);
        message.success('Recurso cadastrado.');
      }
      setModalAberto(false);
      carregar();
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao salvar recurso.');
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (recurso) => {
    try {
      await atualizarRecurso(recurso.id, { ativo: !recurso.ativo });
      carregar();
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao atualizar recurso.');
    }
  };

  const excluir = async (recurso) => {
    try {
      await removerRecurso(recurso.id);
      message.success('Recurso excluído.');
      carregar();
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao excluir recurso.');
    }
  };

  return (
    <div className="resources">
      <header className="resources-header">
        <div>
          <h1>Recursos acadêmicos</h1>
          <p>Salas e equipamentos disponíveis para agendamento.</p>
        </div>
        {isAdmin && (
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            className="resources-new"
            onClick={() => abrirModal()}
          >
            Novo recurso
          </Button>
        )}
      </header>

      <Row gutter={[16, 16]}>
        {resumo.map((item) => (
          <Col xs={24} sm={8} key={item.label}>
            <div className="resources-summary">
              <span className="resources-summary-value">{item.value}</span>
              <span className="resources-summary-label">{item.label}</span>
            </div>
          </Col>
        ))}
      </Row>

      <div className="resources-filters">
        <Input
          allowClear
          size="large"
          prefix={<SearchOutlined />}
          placeholder="Buscar por nome ou descrição"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <Segmented
          size="large"
          value={tipo}
          onChange={setTipo}
          options={[
            { label: 'Todos', value: 'TODOS' },
            { label: 'Salas', value: 'SALA' },
            { label: 'Equipamentos', value: 'EQUIPAMENTO' },
          ]}
        />
      </div>

      {loading ? (
        <div className="resources-loading">
          <Spin size="large" />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="resources-empty">
          <Empty
            description={
              recursos.length === 0
                ? 'Nenhum recurso cadastrado ainda.'
                : 'Nenhum recurso encontrado com esses filtros.'
            }
          />
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {filtrados.map((recurso) => {
            const status = getStatus(recurso);
            return (
              <Col xs={24} sm={12} xl={8} key={recurso.id}>
                <div className={`resource-card ${recurso.ativo ? '' : 'is-inativo'}`}>
                  <div className="resource-card-top">
                    <div className="resource-icon">{TIPOS[recurso.tipo].icon}</div>
                    <span className={`resource-status ${status.className}`}>{status.label}</span>
                  </div>

                  <h3>{recurso.nome}</h3>
                  <p>{recurso.descricao || 'Sem descrição.'}</p>

                  <div className="resource-card-footer">
                    <span className="resource-type">{TIPOS[recurso.tipo].label}</span>

                    {recurso.ativo && !isAdmin && (
                      <Button
                        type="primary"
                        size="small"
                        icon={<CalendarOutlined />}
                        className="resource-request"
                        onClick={() =>
                          navigate('/requests', { state: { recursoId: recurso.id } })
                        }
                      >
                        Solicitar
                      </Button>
                    )}

                    {isAdmin && (
                      <div className="resource-actions">
                        <Tooltip title={recurso.ativo ? 'Desativar' : 'Ativar'}>
                          <Switch
                            size="small"
                            checked={recurso.ativo}
                            onChange={() => alternarAtivo(recurso)}
                          />
                        </Tooltip>
                        <Tooltip title="Editar">
                          <Button
                            type="text"
                            icon={<EditOutlined />}
                            onClick={() => abrirModal(recurso)}
                          />
                        </Tooltip>
                        <Popconfirm
                          title="Excluir recurso"
                          description="Essa ação não pode ser desfeita."
                          okText="Excluir"
                          cancelText="Cancelar"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => excluir(recurso)}
                        >
                          <Tooltip title="Excluir">
                            <Button type="text" danger icon={<DeleteOutlined />} />
                          </Tooltip>
                        </Popconfirm>
                      </div>
                    )}
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
      )}

      <Modal
        title={editando ? 'Editar recurso' : 'Novo recurso'}
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
            rules={[{ required: true, whitespace: true, message: 'Informe o nome do recurso.' }]}
          >
            <Input placeholder="Ex.: Laboratório de Informática 1" />
          </Form.Item>
          <Form.Item name="tipo" label="Tipo" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'Sala', value: 'SALA' },
                { label: 'Equipamento', value: 'EQUIPAMENTO' },
              ]}
            />
          </Form.Item>
          <Form.Item name="descricao" label="Descrição">
            <Input.TextArea rows={3} placeholder="Capacidade, localização, observações..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Resources;
