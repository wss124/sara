import { useEffect, useState } from 'react';
import { Row, Col, DatePicker, Segmented, Spin, Empty, Tooltip, message } from 'antd';
import {
  PieChartOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  FieldTimeOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  ToolOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { carregarEstatisticas } from '../../services/estatisticaService';
import { BarrasHorizontais, Colunas, BarraSegmentada } from './Graficos';
import '../Requests/Requests.css';
import '../Home/Home.css';
import './Statistics.css';

const FORMATO = 'YYYY-MM-DD';

const ATALHOS = [
  { label: 'Últimos 7 dias', value: [dayjs().subtract(6, 'day'), dayjs()] },
  { label: 'Últimos 30 dias', value: [dayjs().subtract(29, 'day'), dayjs()] },
  { label: 'Este mês', value: [dayjs().startOf('month'), dayjs().endOf('month')] },
  {
    label: 'Mês passado',
    value: [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')],
  },
  { label: 'Últimos 6 meses', value: [dayjs().subtract(6, 'month').add(1, 'day'), dayjs()] },
];

// Cores das situações dos pedidos (paleta categórica, sempre na mesma ordem)
const CORES_PEDIDOS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];

// "1 período ocupado" / "3 períodos ocupados"
const periodos = (n) => (n === 1 ? '1 período ocupado' : ` períodos ocupados`);

const EXPLICACAO_OCUPACAO =
  'Cada recurso, em cada turno de cada dia útil (segunda a sexta), é um período. ' +
  'Ele conta como ocupado quando tem reserva aprovada, em uso ou concluída, mesmo que só em parte do turno.';

function Statistics() {
  const [periodo, setPeriodo] = useState([dayjs().subtract(29, 'day'), dayjs()]);
  const [visao, setVisao] = useState('GRAFICOS');
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    carregarEstatisticas(periodo[0].format(FORMATO), periodo[1].format(FORMATO))
      .then((d) => ativo && setDados(d))
      .catch((err) => message.error(err.response?.data?.error ?? 'Erro ao carregar as estatísticas.'))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [periodo]);

  const tabela = visao === 'TABELAS';

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Estatísticas</h1>
          <p>Como os recursos foram usados no período, para apoiar decisões sobre o acervo.</p>
        </div>
      </header>

      <div className="stats-filtros">
        <DatePicker.RangePicker
          value={periodo}
          format="DD/MM/YYYY"
          allowClear={false}
          presets={ATALHOS}
          onChange={(valor) => valor && setPeriodo(valor)}
        />
        <Segmented
          className="page-segmented"
          value={visao}
          onChange={setVisao}
          options={[
            { label: 'Gráficos', value: 'GRAFICOS' },
            { label: 'Tabelas', value: 'TABELAS' },
          ]}
        />
      </div>

      {!dados ? (
        <div className="page-box">
          <Spin size="large" />
        </div>
      ) : (
        <Spin spinning={carregando}>
          <Conteudo dados={dados} tabela={tabela} />
        </Spin>
      )}
    </div>
  );
}

function Conteudo({ dados, tabela }) {
  const { ocupacao, porRecurso, porTurno, porDiaDaSemana, pedidos, pedidosPorSemana, ocorrencias } = dados;
  const horasTotais = porRecurso.reduce((s, r) => s + r.horasReservadas, 0);
  const semTurnos = porTurno.length === 0;

  const indicadores = [
    {
      titulo: 'Taxa de ocupação',
      valor: `${ocupacao.taxa}%`,
      sub: `${ocupacao.periodosOcupados} de ${ocupacao.periodosPossiveis} períodos`,
      icone: <PieChartOutlined />,
      cor: '#2b5797',
    },
    {
      titulo: 'Pedidos de professores',
      valor: pedidos.total,
      sub: pedidos.pendentes ? `${pedidos.pendentes} aguardando decisão` : 'nenhum aguardando decisão',
      icone: <FileTextOutlined />,
      cor: '#14305c',
    },
    {
      titulo: 'Taxa de aprovação',
      valor: `${pedidos.taxaAprovacao}%`,
      sub: `${pedidos.aprovados} aprovados, ${pedidos.recusados} recusados`,
      icone: <CheckCircleOutlined />,
      cor: '#2f7d55',
    },
    {
      titulo: 'Horas reservadas',
      valor: `${Math.round(horasTotais)} h`,
      sub: `em ${dados.periodo.diasUteis} dias úteis`,
      icone: <FieldTimeOutlined />,
      cor: '#b7862a',
    },
  ];

  return (
    <div className="stats">
      <Row gutter={[16, 16]}>
        {indicadores.map((i) => (
          <Col xs={24} sm={12} lg={6} key={i.titulo}>
            <div className="stat-card stats-tile">
              <div className="stat-icon" style={{ color: i.cor, background: `${i.cor}1a` }}>
                {i.icone}
              </div>
              <div>
                <div className="stat-value">{i.valor}</div>
                <div className="stat-title">{i.titulo}</div>
                <div className="stats-tile-sub">{i.sub}</div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Painel
            titulo="Ocupação por recurso"
            sub="Do mais para o menos usado"
            info={EXPLICACAO_OCUPACAO}
          >
            {semTurnos ? (
              <Empty description="Cadastre os turnos para calcular a ocupação." />
            ) : porRecurso.length === 0 ? (
              <Empty description="Nenhum recurso ativo." />
            ) : (
              <BarrasHorizontais
                tabela={tabela}
                colunaRotulo="Recurso"
                itens={porRecurso.map((r) => ({
                  chave: r.id,
                  rotulo: r.nome,
                  valor: r.taxa,
                  detalhe: `${periodos(r.periodosOcupados)} · ${r.horasReservadas} h reservadas`,
                }))}
              />
            )}
          </Painel>
        </Col>

        <Col xs={24} xl={10}>
          <div className="stats-coluna">
            <Painel titulo="Ocupação por turno" info={EXPLICACAO_OCUPACAO}>
              {semTurnos ? (
                <Empty description="Nenhum turno cadastrado." />
              ) : (
                <BarrasHorizontais
                  tabela={tabela}
                  colunaRotulo="Turno"
                  itens={porTurno.map((t) => ({
                    chave: t.id,
                    rotulo: t.nome,
                    valor: t.taxa,
                    detalhe: `${t.horaInicio}–${t.horaFim} · ${periodos(t.periodosOcupados)}`,
                  }))}
                />
              )}
            </Painel>

            <Painel titulo="Ocupação por dia da semana" info={EXPLICACAO_OCUPACAO}>
              <BarrasHorizontais
                tabela={tabela}
                colunaRotulo="Dia"
                itens={porDiaDaSemana.map((d) => ({
                  chave: d.dia,
                  rotulo: d.dia,
                  valor: d.taxa,
                  detalhe: `${periodos(d.periodosOcupados)}`,
                }))}
              />
            </Painel>
          </div>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Painel titulo="Pedidos por semana" sub="Pelo dia de início da reserva">
            <Colunas
              tabela={tabela}
              colunaRotulo="Semana de"
              colunaValor="Pedidos"
              itens={pedidosPorSemana.map((s) => ({
                chave: s.semana,
                rotulo: dayjs(s.semana).format('DD/MM'),
                valor: s.total,
                detalhe: `Semana de ${dayjs(s.semana).format('DD/MM')}: ${s.total} pedido(s)`,
              }))}
            />
          </Painel>
        </Col>

        <Col xs={24} xl={10}>
          <div className="stats-coluna">
            <Painel titulo="Situação dos pedidos">
              <BarraSegmentada
                tabela={tabela}
                partes={[
                  { chave: 'aprovados', rotulo: 'Aprovados', valor: pedidos.aprovados },
                  { chave: 'pendentes', rotulo: 'Pendentes', valor: pedidos.pendentes },
                  { chave: 'recusados', rotulo: 'Recusados', valor: pedidos.recusados },
                  { chave: 'cancelados', rotulo: 'Cancelados', valor: pedidos.cancelados },
                ].map((p, i) => ({ ...p, cor: CORES_PEDIDOS[i] }))}
              />
            </Painel>

            <Painel titulo="Ocorrências" sub="Reservas que terminaram no período">
              <ul className="stats-ocorrencias">
                <Ocorrencia
                  icone={<WarningOutlined />}
                  rotulo="Devoluções atrasadas"
                  valor={ocorrencias.devolucoesAtrasadas}
                />
                <Ocorrencia
                  icone={<ToolOutlined />}
                  rotulo="Devolvidos com defeito ou incompletos"
                  valor={ocorrencias.devolucoesComProblema}
                />
                <Ocorrencia
                  icone={<StopOutlined />}
                  rotulo="Reservas aprovadas e não retiradas"
                  valor={ocorrencias.reservasNaoRetiradas}
                />
              </ul>
            </Painel>
          </div>
        </Col>
      </Row>
    </div>
  );
}

function Painel({ titulo, sub, info, children }) {
  return (
    <section className="home-panel">
      <div className="home-panel-header">
        <div>
          <h3>
            {titulo}
            {info && (
              <Tooltip title={info}>
                <InfoCircleOutlined className="stats-info" />
              </Tooltip>
            )}
          </h3>
          {sub && <span className="home-panel-sub">{sub}</span>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Ocorrencia({ icone, rotulo, valor }) {
  return (
    <li className={valor > 0 ? 'tem-ocorrencia' : ''}>
      <span className="stats-ocorrencia-icone">{icone}</span>
      <span>{rotulo}</span>
      <strong>{valor}</strong>
    </li>
  );
}

export default Statistics;
