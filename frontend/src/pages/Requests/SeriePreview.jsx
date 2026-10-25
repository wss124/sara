import { useEffect, useState } from 'react';
import { Checkbox, Spin, Tag } from 'antd';
import dayjs from 'dayjs';
import { previaSerie } from '../../services/recorrenciaService';

// Campo de formulário com as datas que a série semanal vai gerar. Datas
// indisponíveis aparecem bloqueadas, com o motivo; as livres podem ser
// desmarcadas (ex.: feriados). value = datas desmarcadas ("AAAA-MM-DD").
function SeriePreview({ parametros, value = [], onChange }) {
  const [resultado, setResultado] = useState({ chave: null, datas: null, erro: null });

  const chave = parametros ? JSON.stringify(parametros) : null;
  const atual = resultado.chave === chave ? resultado : null;

  useEffect(() => {
    if (!chave) return;
    let cancelado = false;
    previaSerie(JSON.parse(chave))
      .then((datas) => !cancelado && setResultado({ chave, datas, erro: null }))
      .catch(
        (error) =>
          !cancelado &&
          setResultado({ chave, datas: null, erro: error.response?.data?.error || 'Erro ao conferir as datas.' })
      );
    return () => {
      cancelado = true;
    };
  }, [chave]);

  if (!chave) {
    return (
      <div className="slots-empty">
        Escolha o recurso, o primeiro dia, o horário, os dias da semana e até quando repetir.
      </div>
    );
  }
  if (!atual) {
    return (
      <div className="slots-empty">
        <Spin size="small" />
      </div>
    );
  }
  if (atual.erro) return <div className="slots-empty serie-erro">{atual.erro}</div>;

  const livres = atual.datas.filter((d) => d.ok);
  const marcadas = livres.filter((d) => !value.includes(d.data)).length;
  const alternar = (data) =>
    onChange?.(value.includes(data) ? value.filter((v) => v !== data) : [...value, data]);

  return (
    <div className="serie-preview">
      <p className="serie-resumo">
        <strong>{marcadas}</strong> de {atual.datas.length} data(s) serão solicitadas.
        {livres.length < atual.datas.length &&
          ` ${atual.datas.length - livres.length} indisponível(is) ficarão de fora.`}{' '}
        Desmarque feriados ou dias sem aula.
      </p>
      <ul>
        {atual.datas.map((d) => (
          <li key={d.data} className={d.ok ? '' : 'is-indisponivel'}>
            <Checkbox
              checked={d.ok && !value.includes(d.data)}
              disabled={!d.ok}
              onChange={() => alternar(d.data)}
            >
              {dayjs(d.data).format('ddd, DD/MM/YYYY')}
            </Checkbox>
            {!d.ok && <Tag color="red">{d.motivo}</Tag>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default SeriePreview;
