import { Tooltip, Table } from 'antd';

// Gráficos simples em HTML/CSS: uma série por gráfico, valor escrito ao lado
// da barra e detalhe no tooltip. Cada um tem uma versão em tabela para quem
// prefere ler os números (ou não distingue bem as cores).

// Barras horizontais de 0 a 100%. itens: [{ chave, rotulo, valor, detalhe }]
export function BarrasHorizontais({ itens, sufixo = '%', tabela, colunaRotulo }) {
  if (tabela) {
    return (
      <Table
        size="small"
        pagination={false}
        rowKey="chave"
        dataSource={itens}
        columns={[
          { title: colunaRotulo, dataIndex: 'rotulo' },
          { title: 'Ocupação', dataIndex: 'valor', align: 'right', render: (v) => `${v}${sufixo}` },
          { title: 'Detalhe', dataIndex: 'detalhe' },
        ]}
      />
    );
  }

  return (
    <div className="viz-hbars">
      {itens.map((item) => (
        <Tooltip key={item.chave} title={item.detalhe} placement="topLeft">
          <div className="viz-hbar-row">
            <span className="viz-hbar-label" title={item.rotulo}>
              {item.rotulo}
            </span>
            <span className="viz-hbar-track">
              <span className="viz-hbar-fill" style={{ width: `${item.valor}%` }} />
            </span>
            <span className="viz-hbar-value">
              {item.valor}
              {sufixo}
            </span>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}

// Colunas com altura relativa ao maior valor. itens: [{ chave, rotulo, valor, detalhe }]
export function Colunas({ itens, tabela, colunaRotulo, colunaValor }) {
  if (tabela) {
    return (
      <Table
        size="small"
        pagination={false}
        rowKey="chave"
        dataSource={itens}
        columns={[
          { title: colunaRotulo, dataIndex: 'rotulo' },
          { title: colunaValor, dataIndex: 'valor', align: 'right' },
        ]}
      />
    );
  }

  const maximo = Math.max(1, ...itens.map((i) => i.valor));
  // Com muitas colunas, o número fica só no tooltip para não amontoar
  const mostrarValores = itens.length <= 14;

  return (
    <div className="viz-cols" style={{ '--colunas': itens.length }}>
      {itens.map((item) => (
        <Tooltip key={item.chave} title={item.detalhe}>
          <div className="viz-col">
            <div className="viz-col-area">
              {mostrarValores && <span className="viz-col-value">{item.valor}</span>}
              <span
                className="viz-col-fill"
                style={{ height: `${(item.valor / maximo) * 100}%` }}
              />
            </div>
            <span className="viz-col-label">{item.rotulo}</span>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}

// Barra única dividida em partes (composição de um total), com legenda.
// partes: [{ chave, rotulo, valor, cor }]
export function BarraSegmentada({ partes, tabela }) {
  const total = partes.reduce((s, p) => s + p.valor, 0);
  const pct = (v) => (total ? Math.round((v / total) * 100) : 0);

  if (tabela) {
    return (
      <Table
        size="small"
        pagination={false}
        rowKey="chave"
        dataSource={partes}
        columns={[
          { title: 'Situação', dataIndex: 'rotulo' },
          { title: 'Pedidos', dataIndex: 'valor', align: 'right' },
          { title: '%', dataIndex: 'valor', align: 'right', render: (v) => `${pct(v)}%` },
        ]}
      />
    );
  }

  return (
    <div className="viz-stack">
      <div className="viz-stack-bar">
        {total === 0 ? (
          <span className="viz-stack-empty" />
        ) : (
          partes
            .filter((p) => p.valor > 0)
            .map((p) => (
              <Tooltip key={p.chave} title={`${p.rotulo}: ${p.valor} (${pct(p.valor)}%)`}>
                <span className="viz-stack-seg" style={{ flexGrow: p.valor, background: p.cor }} />
              </Tooltip>
            ))
        )}
      </div>
      <ul className="viz-legend">
        {partes.map((p) => (
          <li key={p.chave}>
            <i style={{ background: p.cor }} />
            <span>{p.rotulo}</span>
            <strong>{p.valor}</strong>
            <small>{pct(p.valor)}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
