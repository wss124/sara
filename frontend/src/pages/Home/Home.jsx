import { Card, Typography, Row, Col, Statistic } from 'antd';
import {
  AppstoreOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';

const { Title, Paragraph } = Typography;

function Home() {
  const stats = [
    {
      title: 'Recursos disponíveis',
      value: 24,
      icon: <AppstoreOutlined />,
      color: '#1677ff',
    },
    {
      title: 'Minhas solicitações',
      value: 3,
      icon: <FileTextOutlined />,
      color: '#722ed1',
    },
    {
      title: 'Solicitações aprovadas',
      value: 2,
      icon: <CheckCircleOutlined />,
      color: '#52c41a',
    },
    {
      title: 'Aguardando aprovação',
      value: 1,
      icon: <ClockCircleOutlined />,
      color: '#faad14',
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 24 }}>
        <Title level={2}>Bem-vindo ao SARA</Title>
        <Paragraph>
          Sistema de Alocação de Recursos Acadêmicos.
        </Paragraph>
        <Paragraph>
          Aqui você poderá consultar recursos acadêmicos, verificar sua
          disponibilidade e acompanhar suas solicitações.
        </Paragraph>
      </Card>

      <Row gutter={[16, 16]}>
        {stats.map((stat) => (
          <Col xs={24} sm={12} lg={6} key={stat.title}>
            <Card>
              <Statistic
                title={stat.title}
                value={stat.value}
                valueStyle={{ color: stat.color }}
                prefix={stat.icon}
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}

export default Home;