import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Progress, Segmented, Empty, Spin, message } from 'antd';
import {
  AppstoreOutlined,
  FieldTimeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  AuditOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { carregarDashboard } from '../../services/dashboardService';
import { getUsuarioLogado } from '../../utils/format';
import { ICONES_TIPO } from '../Requests/constants';
import './Home.css';

// Intervalo de atualização automática do painel de ocupação
const INTERVALO_MS = 30_000;

const FILTROS = [
  { label: 'Todos', value: 'TODOS' },
  { label: 'Em uso', value: 'OCUPADOS' },
  { label: 'Livres', value: 'LIVRES' },
];

function hora(data) {
  return dayjs(data).format('HH:mm');
}

function descreverProxima(proxima) {
  if (!proxima) return 'Sem reservas futuras';
  const inicio = dayjs(proxima.dataInicio);
  const quando = inicio.isSame(dayjs(), 'day') ? 'hoje' : inicio.format('DD/MM');
  return `Próxima: ${quando} às ${inicio.format('HH:mm')}`;
}

function Home() {
  const navigate = useNavigate();
  const usuario = getUsuarioLogado();
  const isAdmin = usuario?.perfil === 'ADMIN';
  const primeiroNome = usuario?.nome?.split(' ')[0];

  const [dados, setDados] = useState(null);
  const [atualizando, setAtualizando] = useState(false);
  const [filtro, setFiltro] = useState('TODOS');

  const carregar = () => {
    setAtualizando(true);
    return carregarDashboard()
      .then(setDados)
      .catch((error) =>
        message.error(error.response?.data?.error || 'Erro ao carregar o dashboard.')
      )
      .finally(() => setAtualizando(false));
  };

  useEffect(() => {
    carregar();
    const timer = setInterval(carregar, INTERVALO_MS);
    return () => clearInterval(timer);
  }, []);

  if (!dados) {
    return (
      <div className="home-loading">
        <Spin size="large" />
      </div>
    );
  }

  const { recursos, minhas, pendentesGerais, ocupacao, reservasHoje } = dados;
  const livres = recursos.total - recursos.ocupados;
  const taxa = recursos.total ? Math.round((recursos.ocupados / recursos.total) * 100) : 0;

  const stats = [
    {
      title: 'Recursos livres agora',
      value: livres,
      icon: <AppstoreOutlined />,
      color: '#2b5797',
      to: '/resources',
    },
    {
      title: 'Recursos em uso agora',
      value: recursos.ocupados,
      icon: <FieldTimeOutlined />,
      color: '#5b3f99',
      to: '/resources',
    },
    {
      title: 'Minhas reservas aprovadas',
      value: minhas.aprovadas,
      icon: <CheckCircleOutlined />,
      color: '#2f7d55',
      to: '/requests',
    },
    isAdmin
      ? {
          title: 'Solicitações para aprovar',
          value: pendentesGerais,
          icon: <AuditOutlined />,
          color: '#b7862a',
          to: '/approvals',
        }
      : {
          title: 'Aguardando aprovação',
          value: minhas.pendentes,
          icon: <ClockCircleOutlined />,
          color: '#b7862a',
          to: '/requests',
        },
  ];

  const ocupacaoFiltrada = ocupacao.filter((r) => {
    if (filtro === 'OCUPADOS') return r.ocupadoAgora;
    if (filtro === 'LIVRES') return !r.ocupadoAgora;
    return true;
  });

  return (
    <div className="home">
      <section className="home-hero">
        <span className="home-deco home-deco-circle" />
        <span className="home-deco home-deco-plus">+</span>
        <span className="home-deco home-deco-dots" />

        <div className="home-hero-content">
          <span className="home-hero-tag">SARA</span>
          <h1>{primeiroNome ? `Olá, ${primeiroNome}!` : 'Bem-vindo ao SARA'}</h1>
          <p>
            Consulte recursos acadêmicos, verifique sua disponibilidade e
            acompanhe suas solicitações em um só lugar.
          </p>
        </div>
      </section>

      <div className="home-section-header">
        <h2 className="home-section-title">Visão geral</h2>
        <button type="button" className="home-refresh" onClick={carregar}>
          <ReloadOutlined spin={atualizando} /> Atualizado às{' '}
          {dayjs(dados.geradoEm).format('HH:mm:ss')}
        </button>
      </div>

      <Row gutter={[16, 16]}>
        {stats.map((stat) => (
          <Col xs={24} sm={12} lg={6} key={stat.title}>
            <button type="button" className="stat-card" onClick={() => navigate(stat.to)}>
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
            </button>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <section className="home-panel">
            <div className="home-panel-header">
              <div>
                <h3>Ocupação em tempo real</h3>
                <span className="home-panel-sub">
                  {recursos.ocupados} de {recursos.total} recursos em uso ({taxa}%)
                </span>
              </div>
              <Segmented options={FILTROS} value={filtro} onChange={setFiltro} />
            </div>

            <Progress
              percent={taxa}
              showInfo={false}
              strokeColor={{ from: '#13305f', to: '#5b3f99' }}
            />

            {ocupacaoFiltrada.length === 0 ? (
              <Empty description="Nenhum recurso nesta situação" />
            ) : (
              <div className="occupancy-grid">
                {ocupacaoFiltrada.map((r) => (
                  <div
                    key={r.id}
                    className={`occupancy-item ${r.ocupadoAgora ? 'is-busy' : 'is-free'}`}
                  >
                    <div className="occupancy-top">
                      <span className="occupancy-icon">{ICONES_TIPO[r.tipo]}</span>
                      <span className="occupancy-name">{r.nome}</span>
                    </div>
                    <span className="occupancy-state">
                      {r.ocupadoAgora
                        ? `Em uso até ${hora(r.atual.dataFim)}`
                        : 'Disponível agora'}
                    </span>
                    <span className="occupancy-detail">
                      {r.ocupadoAgora ? r.atual.usuario.nome : descreverProxima(r.proxima)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </Col>

        <Col xs={24} xl={8}>
          <section className="home-panel">
            <div className="home-panel-header">
              <div>
                <h3>Agenda de hoje</h3>
                <span className="home-panel-sub">{dayjs().format('dddd, DD/MM')}</span>
              </div>
            </div>

            {reservasHoje.length === 0 ? (
              <Empty description="Nenhuma reserva aprovada para hoje" />
            ) : (
              <ul className="agenda">
                {reservasHoje.map((reserva) => {
                  const emAndamento =
                    dayjs().isAfter(reserva.dataInicio) && dayjs().isBefore(reserva.dataFim);
                  const encerrada = dayjs().isAfter(reserva.dataFim);
                  return (
                    <li
                      key={reserva.id}
                      className={`agenda-item${emAndamento ? ' is-now' : ''}${
                        encerrada ? ' is-past' : ''
                      }`}
                    >
                      <span className="agenda-time">
                        {hora(reserva.dataInicio)} – {hora(reserva.dataFim)}
                      </span>
                      <span className="agenda-resource">
                        {ICONES_TIPO[reserva.recurso.tipo]} {reserva.recurso.nome}
                      </span>
                      <span className="agenda-user">{reserva.usuario.nome}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </Col>
      </Row>
    </div>
  );
}

export default Home;
