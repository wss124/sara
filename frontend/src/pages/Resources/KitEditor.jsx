import { Select, Checkbox, Button, Empty } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

// Campo de formulário com os acessórios que acompanham o recurso.
// value = [{ acessorioId, obrigatorio }]
function KitEditor({ acessorios, value = [], onChange }) {
  const nomes = Object.fromEntries(acessorios.map((a) => [a.id, a.nome]));
  const usados = new Set(value.map((i) => i.acessorioId));

  const adicionar = (acessorioId) => onChange?.([...value, { acessorioId, obrigatorio: true }]);
  const remover = (acessorioId) => onChange?.(value.filter((i) => i.acessorioId !== acessorioId));
  const alternar = (acessorioId) =>
    onChange?.(
      value.map((i) => (i.acessorioId === acessorioId ? { ...i, obrigatorio: !i.obrigatorio } : i))
    );

  return (
    <div className="kit-editor">
      <Select
        placeholder="Adicionar acessório"
        value={null}
        showSearch
        optionFilterProp="label"
        onChange={adicionar}
        options={acessorios
          .filter((a) => a.ativo && !usados.has(a.id))
          .map((a) => ({ value: a.id, label: a.nome }))}
        notFoundContent="Cadastre acessórios na tela Acessórios."
        style={{ width: '100%' }}
      />
      {value.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum item acompanha este recurso." />
      ) : (
        <ul className="kit-editor-list">
          {value.map((item) => (
            <li key={item.acessorioId}>
              <span>{nomes[item.acessorioId] ?? 'Acessório removido'}</span>
              <Checkbox checked={item.obrigatorio} onChange={() => alternar(item.acessorioId)}>
                Obrigatório
              </Checkbox>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={() => remover(item.acessorioId)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default KitEditor;
