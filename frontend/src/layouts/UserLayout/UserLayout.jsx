import { Layout, Menu, Avatar } from 'antd';
import {
  HomeOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import './UserLayout.css';

const { Header, Sider, Content } = Layout;

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('sara_user'));
  } catch {
    return null;
  }
}

function UserLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();

  const menuItems = [
    {
      key: '/home',
      icon: <HomeOutlined />,
      label: 'Início',
    },
    {
      key: '/resources',
      icon: <AppstoreOutlined />,
      label: 'Recursos',
    },
    {
      key: '/requests',
      icon: <FileTextOutlined />,
      label: 'Minhas solicitações',
    },
    {
      key: '/profile',
      icon: <UserOutlined />,
      label: 'Perfil',
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem('sara_auth');
    localStorage.removeItem('sara_token');
    localStorage.removeItem('sara_user');
    navigate('/login');
  };

  return (
    <Layout className="user-layout">
      <Sider className="user-sider" width={230} breakpoint="md" collapsedWidth={0}>
        <div className="user-sider-brand">SARA</div>

        <Menu
          mode="inline"
          items={menuItems}
          selectedKeys={[location.pathname]}
          onClick={({ key }) => navigate(key)}
        />

        <button type="button" className="user-sider-logout" onClick={handleLogout}>
          <LogoutOutlined /> Sair
        </button>
      </Sider>

      <Layout>
        <Header className="user-header">
          <span className="user-header-title">
            Sistema de Alocação de Recursos Acadêmicos
          </span>

          <div className="user-header-user">
            <span>{user?.nome}</span>
            <Avatar icon={<UserOutlined />} />
          </div>
        </Header>

        <Content className="user-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default UserLayout;
