import { Layout, Menu } from 'antd';
import {
  HomeOutlined,
  AppstoreOutlined,
  FileTextOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

function UserLayout() {
  const navigate = useNavigate();

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

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider>
        <div
          style={{
            color: '#fff',
            fontSize: '24px',
            fontWeight: 'bold',
            padding: '20px',
            textAlign: 'center',
          }}
        >
          SARA
        </div>

        <Menu
          theme="dark"
          mode="inline"
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
          }}
        >
          Sistema de Alocação de Recursos Acadêmicos
        </Header>

        <Content style={{ margin: '24px' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

export default UserLayout;
