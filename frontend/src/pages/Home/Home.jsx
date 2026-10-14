import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Row, Col, Progress, Segmented, Empty, Spin, Alert, Button, message } from 'antd';
import {
  AppstoreOutlined,
  FieldTimeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  AuditOutlined,
  ReloadOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { carregarDashboard } from '../../services/dashboardService';
import { getUsuarioLogado, responsavelPela } from '../../utils/format';
import { ICONES_TIPO } from '../Requests/constants';
import { capaDoRecurso } from '../../utils/recursoFoto';
import './Home.css';

// Intervalo de atualização automática do painel de ocupação
const INTERVALO_MS = 30_000;

const FILTROS = [
  { label: 'Todos', value: 'TODOS' },
  { label: 'Em uso', value: 'OCUPADOS' },
  { label: 'Livres', value: 'LIVRES' },
  { label: 'Manutenção', value: 'MANUTENCAO' },
];

// Classe do card e texto principal de cada situação vinda da API
const SITUACOES = {
  LIVRE: { className: 'is-free', texto: () => 'Disponível agora' },
  AGUARDANDO_RETIRADA: { className: 'is-waiting', texto: () => 'Reservado, aguardando retirada' },
  EM_USO: { className: 'is-busy', texto: (r) => `Em uso até ${hora(r.atual.dataFim)}` },
  ATRASADO: {
    className: 'is-late',
    texto: (r) => `Devolução atrasada (era até ${hora(r.atual.dataFim)})`,
  },
  EM_MANUTENCAO: { className: 'is-maintenance', texto: () => 'Em manutenção' },
  INDISPONIVEL: { className: 'is-maintenance', texto: () => 'Indisponível' },
};

// Selo da reserva na agenda do dia
function seloDaAgenda(reserva) {
  if (reserva.status === 'CONCLUIDA') return 'Devolvido';
  if (reserva.status === 'EM_ANDAMENTO') return 'Em uso';
  if (dayjs().isAfter(reserva.dataInicio)) return 'Aguardando retirada';
  return null;
}

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
  const taxa = recursos.total ? Math.round((recursos.ocupados / recursos.total) * 100) : 0;

  const stats = [
    {
      title: 'Recursos livres agora',
      value: recursos.livres,
      icon: <AppstoreOutlined />,
      color: '#2b5797',
      to: '/resources',
    },
    {
      title: 'Em uso ou reservados agora',
      value: recursos.ocupados,
      icon: <FieldTimeOutlined />,
      color: '#14305c',
      to: isAdmin ? '/handovers' : '/resources',
    },
    isAdmin
      ? {
          title: 'Em manutenção ou indisponíveis',
          value: recursos.emManutencao + recursos.indisponiveis,
          icon: <ToolOutlined />,
          color: '#b5462b',
          to: '/resources',
        }
      : {
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
    if (filtro === 'LIVRES') return r.situacao === 'LIVRE';
    if (filtro === 'MANUTENCAO') return r.situacao === 'EM_MANUTENCAO' || r.situacao === 'INDISPONIVEL';
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

      {isAdmin && recursos.atrasados > 0 && (
        <Alert
          type="error"
          showIcon
          title={`${recursos.atrasados} recurso(s) com devolução atrasada.`}
          action={
            <Button size="small" danger onClick={() => navigate('/handovers')}>
              Ver no balcão
            </Button>
          }
        />
      )}

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
              strokeColor={{ from: '#0b2149', to: '#14305c' }}
            />

            {ocupacaoFiltrada.length === 0 ? (
              <Empty description="Nenhum recurso nesta situação" />
            ) : (
              <div className="occupancy-grid">
                {ocupacaoFiltrada.map((r) => (
                  <div key={r.id} className={`occupancy-item ${SITUACOES[r.situacao].className}`}>
                    <div className="occupancy-top">
                      <img className="occupancy-thumb" src={capaDoRecurso(r)} alt="" loading="lazy" />
                      <span className="occupancy-name">
                        <span className="occupancy-icon">{ICONES_TIPO[r.tipo]}</span> {r.nome}
                      </span>
                    </div>
                    <span className="occupancy-state">{SITUACOES[r.situacao].texto(r)}</span>
                    <span className="occupancy-detail">
                      {r.atual && r.ocupadoAgora
                        ? responsavelPela(r.atual)
                        : r.situacao === 'LIVRE'
                          ? descreverProxima(r.proxima)
                          : r.localizacao || ''}
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
              <Empty description="Nenhuma reserva para hoje" />
            ) : (
              <ul className="agenda">
                {reservasHoje.map((reserva) => {
                  const emAndamento = reserva.status === 'EM_ANDAMENTO';
                  const encerrada =
                    reserva.status === 'CONCLUIDA' ||
                    (reserva.status === 'APROVADA' && dayjs().isAfter(reserva.dataFim));
                  const selo = seloDaAgenda(reserva);
                  return (
                    <li
                      key={reserva.id}
                      className={`agenda-item${emAndamento ? ' is-now' : ''}${
                        encerrada ? ' is-past' : ''
                      }`}
                    >
                      <img
                        className="agenda-thumb"
                        src={capaDoRecurso(reserva.recurso)}
                        alt=""
                        loading="lazy"
                      />
                      <div className="agenda-info">
                        <span className="agenda-time">
                          {hora(reserva.dataInicio)} – {hora(reserva.dataFim)}
                        </span>
                        <span className="agenda-resource">
                          {ICONES_TIPO[reserva.recurso.tipo]} {reserva.recurso.nome}
                        </span>
                        <span className="agenda-user">{responsavelPela(reserva)}</span>
                        {selo && <span className="agenda-selo">{selo}</span>}
                      </div>
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
