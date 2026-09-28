import { Row, Col } from 'antd';
import {
  AppstoreOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import './Home.css';

function getUserName() {
  try {
    const user = JSON.parse(localStorage.getItem('sara_user'));
    return user?.nome?.split(' ')[0];
  } catch {
    return undefined;
  }
}

function Home() {
  const userName = getUserName();

  const stats = [
    {
      title: 'Recursos disponíveis',
      value: 24,
      icon: <AppstoreOutlined />,
      color: '#2b5797',
    },
    {
      title: 'Minhas solicitações',
      value: 3,
      icon: <FileTextOutlined />,
      color: '#5b3f99',
    },
    {
      title: 'Solicitações aprovadas',
      value: 2,
      icon: <CheckCircleOutlined />,
      color: '#2f7d55',
    },
    {
      title: 'Aguardando aprovação',
      value: 1,
      icon: <ClockCircleOutlined />,
      color: '#b7862a',
    },
  ];

  return (
    <div className="home">
      <section className="home-hero">
        <span className="home-deco home-deco-circle" />
        <span className="home-deco home-deco-plus">+</span>
        <span className="home-deco home-deco-dots" />

        <div className="home-hero-content">
          <span className="home-hero-tag">SARA</span>
          <h1>{userName ? `Olá, ${userName}!` : 'Bem-vindo ao SARA'}</h1>
          <p>
            Consulte recursos acadêmicos, verifique sua disponibilidade e
            acompanhe suas solicitações em um só lugar.
          </p>
        </div>
      </section>

      <h2 className="home-section-title">Visão geral</h2>

      <Row gutter={[16, 16]}>
        {stats.map((stat) => (
          <Col xs={24} sm={12} lg={6} key={stat.title}>
            <div className="stat-card">
              <div
                className="stat-icon"
                style={{ color: stat.color, background: `${stat.color}1a` }}
              >
                {stat.icon}
              </div>
              <div>
                <div className="stat-value">{stat.value}</div>
                <div className="stat-title">{stat.title}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>
    </div>
  );
}

export default Home;
