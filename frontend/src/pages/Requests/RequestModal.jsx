import { useEffect, useState } from 'react';
import { Modal, Form, Select, DatePicker, Input, Segmented, message } from 'antd';
import dayjs from 'dayjs';
import { EnvironmentOutlined } from '@ant-design/icons';
import TimeSlotGrid from './TimeSlotGrid';
import AcessoriosDoPedido from './AcessoriosDoPedido';
import { listarRecursos } from '../../services/recursoService';
import {
  consultarOcupacao,
  criarSolicitacao,
  lancarReserva,
} from '../../services/solicitacaoService';
import { listarUsuarios } from '../../services/usuarioService';
import { ESTADOS_RECURSO, recursoBloqueado } from '../../utils/estadoRecurso';

// Com `admin`, o modal vira "Nova reserva": o admin escolhe para quem é a
// reserva (ou uso institucional) e ela já é registrada como aprovada.
function RequestModal({ open, recursoInicial, admin = false, onClose, onCreated }) {
  const [form] = Form.useForm();
  const [recursos, setRecursos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  // Reservas guardadas junto com a combinação recurso/dia a que pertencem,
  // para não exibir dados de uma consulta anterior enquanto a nova carrega
  const [ocupacao, setOcupacao] = useState({ chave: null, lista: null });
  const [salvando, setSalvando] = useState(false);

  const recursoId = Form.useWatch('recursoId', form);
  const data = Form.useWatch('data', form);
  const paraQuem = Form.useWatch('paraQuem', form);
  const horario = Form.useWatch('horario', form);
  const institucional = admin && paraQuem === 'INSTITUCIONAL';
  const recursoSelecionado = recursos.find((r) => r.id === recursoId);
  const chave = recursoId && data ? `${recursoId}-${data.valueOf()}` : null;
  const reservas = chave && ocupacao.chave === chave ? ocupacao.lista : null;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ recursoId: recursoInicial, paraQuem: 'USUARIO' });
    listarRecursos()
      .then((lista) => setRecursos(lista.filter((r) => r.ativo)))
      .catch(() => message.error('Erro ao carregar recursos.'));
    if (admin) {
      listarUsuarios()
        .then((lista) => setUsuarios(lista.filter((u) => u.perfil !== 'ADMIN')))
        .catch(() => message.error('Erro ao carregar usuários.'));
    }
  }, [open, recursoInicial, admin, form]);

  // Busca as reservas aprovadas do recurso no dia escolhido. Trocar o recurso
  // ou a data invalida o horário já marcado na grade.
  useEffect(() => {
    form.setFieldValue('horario', undefined);
    if (!chave) return;
    let cancelado = false;
    consultarOcupacao(
      recursoId,
      data.startOf('day').toISOString(),
      data.endOf('day').toISOString()
    )
      .then((lista) => !cancelado && setOcupacao({ chave, lista }))
      .catch(() => !cancelado && message.error('Erro ao consultar os horários ocupados.'));
    return () => {
      cancelado = true;
    };
  }, [chave, recursoId, data, form]);

  const salvar = async () => {
    const valores = await form.validateFields();
    const [inicio, fim] = valores.horario;

    const pedido = {
      recursoId: valores.recursoId,
      dataInicio: inicio.toISOString(),
      dataFim: fim.toISOString(),
      observacao: valores.observacao,
      acessorios: (valores.acessorios ?? []).map((id) => ({ id })),
    };

    setSalvando(true);
    try {
      if (admin) {
        const reserva = await lancarReserva({
          ...pedido,
          institucional,
          usuarioId: institucional ? undefined : valores.usuarioId,
        });
        message.success('Reserva registrada e já aprovada.');
        if (reserva.pendentesConflitantes > 0) {
          message.warning(
            `Há ${reserva.pendentesConflitantes} solicitação(ões) pendente(s) nesse horário. Recuse-as em Aprovações.`,
            6
          );
        }
      } else {
        await criarSolicitacao(pedido);
        message.success('Solicitação enviada! Aguarde a aprovação do administrador.');
      }
      onCreated();
    } catch (error) {
      message.error(
        error.response?.data?.error ||
          (admin ? 'Erro ao registrar reserva.' : 'Erro ao enviar solicitação.')
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      title={admin ? 'Nova reserva' : 'Nova solicitação'}
      open={open}
      onCancel={onClose}
      onOk={salvar}
      okText={admin ? 'Registrar reserva' : 'Enviar solicitação'}
      cancelText="Cancelar"
      confirmLoading={salvando}
      width={720}
      forceRender
    >
      <Form form={form} layout="vertical" requiredMark={false}>
        {admin && (
          <>
            <Form.Item name="paraQuem" label="Para quem é a reserva">
              <Segmented
                block
                options={[
                  { label: 'Usuário cadastrado', value: 'USUARIO' },
                  { label: 'Uso institucional', value: 'INSTITUCIONAL' },
                ]}
              />
            </Form.Item>
            {!institucional && (
              <Form.Item
                name="usuarioId"
                label="Responsável"
                rules={[{ required: true, message: 'Escolha o responsável pela reserva.' }]}
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Busque pelo nome ou e-mail"
                  options={usuarios.map((u) => ({
                    value: u.id,
                    label: `${u.nome} · ${u.email}`,
                  }))}
                />
              </Form.Item>
            )}
          </>
        )}

        <Form.Item
          name="recursoId"
          label="Recurso"
          rules={[{ required: true, message: 'Escolha um recurso.' }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="Selecione uma sala ou equipamento"
            options={recursos.map((r) => ({
              value: r.id,
              label: recursoBloqueado(r) ? `${r.nome} (${ESTADOS_RECURSO[r.estado].label.toLowerCase()})` : r.nome,
              disabled: recursoBloqueado(r),
            }))}
          />
        </Form.Item>

        {recursoSelecionado?.localizacao && (
          <p className="request-location request-location-hint">
            <EnvironmentOutlined /> Retirada em: {recursoSelecionado.localizacao}
          </p>
        )}

        <Form.Item name="data" label="Data" rules={[{ required: true, message: 'Escolha a data.' }]}>
          <DatePicker
            format="DD/MM/YYYY"
            style={{ width: '100%' }}
            disabledDate={(d) => d.isBefore(dayjs(), 'day')}
          />
        </Form.Item>

        <Form.Item
          name="horario"
          label="Horário"
          rules={[{ required: true, message: 'Escolha o horário na grade.' }]}
        >
          <TimeSlotGrid
            key={chave}
            data={chave ? data : null}
            reservas={reservas}
          />
        </Form.Item>

        {recursoSelecionado?.acessorios?.length > 0 && (
          <Form.Item name="acessorios" label="Itens que acompanham">
            <AcessoriosDoPedido recursoId={recursoId} periodo={horario} />
          </Form.Item>
        )}

        <Form.Item
          name="observacao"
          label={institucional ? 'Finalidade' : 'Observação (opcional)'}
          rules={
            institucional
              ? [{ required: true, whitespace: true, message: 'Descreva a finalidade.' }]
              : []
          }
        >
          <Input.TextArea
            rows={3}
            placeholder={
              institucional
                ? 'Ex.: Prova de Cálculo I, reunião do colegiado...'
                : 'Ex.: aula prática da disciplina de Redes'
            }
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default RequestModal;
