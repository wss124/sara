import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Popconfirm,
  Tag,
  Tooltip,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EnvironmentOutlined } from '@ant-design/icons';
import {
  listarAcessorios,
  criarAcessorio,
  atualizarAcessorio,
  removerAcessorio,
  regularizarAcessorio,
} from '../../services/acessorioService';
import '../Requests/Requests.css';

// Admin: itens que acompanham os recursos (extensão, cabo HDMI, controle...)
function Accessories() {
  const [acessorios, setAcessorios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [form] = Form.useForm();

  const carregar = () =>
    listarAcessorios()
      .then(setAcessorios)
      .catch((error) =>
        message.error(error.response?.data?.error || 'Erro ao carregar acessórios.')
      )
      .finally(() => setLoading(false));

  useEffect(() => {
    carregar();
  }, []);

  const abrirModal = (acessorio = null) => {
    setEditando(acessorio);
    form.setFieldsValue(
      acessorio
        ? {
            nome: acessorio.nome,
            descricao: acessorio.descricao,
            localizacao: acessorio.localizacao,
            quantidade: acessorio.quantidade,
          }
        : { nome: '', descricao: '', localizacao: '', quantidade: 1 }
    );
    setModalAberto(true);
  };

  const salvar = async () => {
    const valores = await form.validateFields();
    setSalvando(true);
    try {
      if (editando) {
        await atualizarAcessorio(editando.id, valores);
      } else {
        await criarAcessorio(valores);
      }
      message.success(editando ? 'Acessório atualizado.' : 'Acessório cadastrado.');
      setModalAberto(false);
      carregar();
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao salvar acessório.');
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
      message.error(error.response?.data?.error || 'Erro ao atualizar acessório.');
    }
  };

  const colunas = [
    {
      title: 'Acessório',
      dataIndex: 'nome',
      render: (nome, a) => (
        <div>
          <strong>{nome}</strong>
          {a.descricao && <div className="request-meta">{a.descricao}</div>}
        </div>
      ),
    },
    {
      title: 'Onde fica',
      dataIndex: 'localizacao',
      render: (local) =>
        local ? (
          <span>
            <EnvironmentOutlined /> {local}
          </span>
        ) : (
          <span className="request-meta">Não informado</span>
        ),
    },
    {
      title: 'Quantidade',
      dataIndex: 'quantidade',
      width: 150,
      render: (quantidade, a) => (
        <div>
          {quantidade}
          {a.emFalta > 0 && (
            <div>
              <Tag color="red">{a.emFalta} em falta</Tag>
              <Popconfirm
                title="O item foi encontrado ou reposto?"
                okText="Sim, regularizar"
                cancelText="Voltar"
                onConfirm={() =>
                  executar(() => regularizarAcessorio(a.id), 'Estoque regularizado.')
                }
              >
                <Button type="link" size="small">
                  Regularizar
                </Button>
              </Popconfirm>
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Acompanha',
      dataIndex: 'recursos',
      render: (recursos) =>
        recursos.length === 0 ? (
          <span className="request-meta">Nenhum recurso</span>
        ) : (
          recursos.map((r) => (
            <Tag key={r.id} color={r.obrigatorio ? 'blue' : 'default'}>
              {r.nome}
              {r.obrigatorio ? '' : ' (opcional)'}
            </Tag>
          ))
        ),
    },
    {
      title: 'Ativo',
      dataIndex: 'ativo',
      width: 80,
      render: (ativo, a) => (
        <Switch
          size="small"
          checked={ativo}
          onChange={() => executar(() => atualizarAcessorio(a.id, { ativo: !ativo }))}
        />
      ),
    },
    {
      title: '',
      key: 'acoes',
      width: 100,
      render: (_, a) => (
        <>
          <Tooltip title="Editar">
            <Button type="text" icon={<EditOutlined />} onClick={() => abrirModal(a)} />
          </Tooltip>
          <Popconfirm
            title="Excluir acessório"
            description="Ele sai também do kit dos recursos."
            okText="Excluir"
            cancelText="Cancelar"
            okButtonProps={{ danger: true }}
            onConfirm={() => executar(() => removerAcessorio(a.id), 'Acessório excluído.')}
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
          <h1>Acessórios</h1>
          <p>Itens que acompanham os recursos, como extensões, cabos e controles.</p>
        </div>
        <Button
          type="primary"
          size="large"
          icon={<PlusOutlined />}
          className="page-primary-button"
          onClick={() => abrirModal()}
        >
          Novo acessório
        </Button>
      </header>

      <Table
        rowKey="id"
        columns={colunas}
        dataSource={acessorios}
        loading={loading}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        locale={{ emptyText: 'Nenhum acessório cadastrado.' }}
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title={editando ? 'Editar acessório' : 'Novo acessório'}
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
            <Input placeholder="Ex.: Extensão 5 m" />
          </Form.Item>
          <Form.Item name="localizacao" label="Onde fica">
            <Input prefix={<EnvironmentOutlined />} placeholder="Ex.: Dispensa do Bloco B" />
          </Form.Item>
          <Form.Item
            name="quantidade"
            label="Quantidade disponível"
            rules={[{ required: true, message: 'Informe a quantidade.' }]}
          >
            <InputNumber min={1} precision={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="descricao" label="Descrição">
            <Input.TextArea rows={2} placeholder="Observações..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Accessories;
