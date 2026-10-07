import { useEffect, useState } from 'react';
import { Table, Select, Segmented, Alert, Tag, message } from 'antd';
import dayjs from 'dayjs';
import { listarUsuarios, alterarPerfil } from '../../services/usuarioService';
import { getUsuarioLogado } from '../../utils/format';
import '../Requests/Requests.css';

const PERFIS = [
  { value: 'ALUNO', label: 'Aluno' },
  { value: 'PROFESSOR', label: 'Professor' },
  { value: 'ADMIN', label: 'Administrador' },
];

function Users() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('TODOS');
  const [salvando, setSalvando] = useState(null);
  const eu = getUsuarioLogado();

  const carregar = (perfil) =>
    listarUsuarios(perfil === 'TODOS' ? undefined : perfil)
      .then(setUsuarios)
      .catch((error) =>
        message.error(error.response?.data?.error || 'Erro ao carregar usuários.')
      )
      .finally(() => setLoading(false));

  useEffect(() => {
    carregar(filtro);
  }, [filtro]);

  const mudarPerfil = async (usuario, perfil) => {
    setSalvando(usuario.id);
    try {
      await alterarPerfil(usuario.id, perfil);
      message.success(`${usuario.nome} agora é ${PERFIS.find((p) => p.value === perfil).label}.`);
      carregar(filtro);
    } catch (error) {
      message.error(error.response?.data?.error || 'Erro ao alterar perfil.');
    } finally {
      setSalvando(null);
    }
  };

  const colunas = [
    { title: 'Nome', dataIndex: 'nome' },
    { title: 'E-mail', dataIndex: 'email' },
    {
      title: 'Perfil',
      dataIndex: 'perfil',
      width: 200,
      render: (perfil, usuario) =>
        usuario.id === eu?.id ? (
          <Tag>Administrador (você)</Tag>
        ) : (
          <Select
            value={perfil}
            options={PERFIS}
            loading={salvando === usuario.id}
            disabled={salvando === usuario.id}
            onChange={(novo) => mudarPerfil(usuario, novo)}
            style={{ width: 170 }}
          />
        ),
    },
    {
      title: 'Cadastro',
      dataIndex: 'criadoEm',
      width: 130,
      render: (data) => dayjs(data).format('DD/MM/YYYY'),
    },
  ];

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Usuários</h1>
          <p>Todo cadastro entra como Aluno. Promova aqui os professores e administradores.</p>
        </div>
      </header>

      <Alert
        type="info"
        showIcon
        title="A mudança de perfil vale a partir do próximo login do usuário."
        style={{ marginBottom: 16 }}
      />

      <Segmented
        value={filtro}
        onChange={(valor) => {
          setLoading(true);
          setFiltro(valor);
        }}
        options={[{ value: 'TODOS', label: 'Todos' }, ...PERFIS]}
        style={{ marginBottom: 16 }}
      />

      <Table
        rowKey="id"
        columns={colunas}
        dataSource={usuarios}
        loading={loading}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        locale={{ emptyText: 'Nenhum usuário encontrado.' }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}

export default Users;
