import { useEffect, useState } from 'react';
import { Checkbox, Spin, Tag } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import { consultarDisponibilidadeAcessorios } from '../../services/acessorioService';

// Campo de formulário com os itens que acompanham o recurso no período
// escolhido. Obrigatórios aparecem marcados e travados; o valor do campo são
// os ids dos opcionais escolhidos.
function AcessoriosDoPedido({ recursoId, periodo, value = [], onChange }) {
  const [resultado, setResultado] = useState({ chave: null, itens: null });

  const chave = recursoId && periodo ? `${recursoId}-${periodo[0].valueOf()}-${periodo[1].valueOf()}` : null;
  const itens = resultado.chave === chave ? resultado.itens : null;

  useEffect(() => {
    if (!chave) return;
    let cancelado = false;
    consultarDisponibilidadeAcessorios(recursoId, periodo[0].toISOString(), periodo[1].toISOString())
      .then((lista) => !cancelado && setResultado({ chave, itens: lista }))
      .catch(() => !cancelado && setResultado({ chave, itens: [] }));
    return () => {
      cancelado = true;
    };
  }, [chave, recursoId, periodo]);

  // Desmarca opcionais que ficaram sem unidade livre ao trocar o horário
  useEffect(() => {
    if (!itens) return;
    const semEstoque = new Set(itens.filter((i) => i.livres < 1).map((i) => i.id));
    if (value.some((id) => semEstoque.has(id))) {
      onChange?.(value.filter((id) => !semEstoque.has(id)));
    }
  }, [itens, value, onChange]);

  if (!chave) {
    return <div className="slots-empty">Escolha o horário para ver os itens disponíveis.</div>;
  }
  if (!itens) {
    return (
      <div className="slots-empty">
        <Spin size="small" />
      </div>
    );
  }

  const alternar = (id) =>
    onChange?.(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <ul className="acessorios-pedido">
      {itens.map((a) => {
        const semEstoque = a.livres < 1;
        return (
          <li key={a.id} className={semEstoque ? 'is-indisponivel' : ''}>
            <Checkbox
              checked={a.obrigatorio || value.includes(a.id)}
              disabled={a.obrigatorio || semEstoque}
              onChange={() => alternar(a.id)}
            >
              {a.nome}
            </Checkbox>
            {a.obrigatorio ? <Tag color="blue">Acompanha sempre</Tag> : <Tag>Opcional</Tag>}
            {semEstoque && <Tag color="red">Sem unidade livre nesse horário</Tag>}
            {a.localizacao && (
              <span className="acessorios-pedido-local">
                <EnvironmentOutlined /> {a.localizacao}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default AcessoriosDoPedido;
