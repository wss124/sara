import { useEffect, useMemo, useState } from 'react';
import { Modal, Form, Select, DatePicker, Input, Segmented, Alert, message } from 'antd';
import dayjs from 'dayjs';
import { EnvironmentOutlined } from '@ant-design/icons';
import TimeSlotGrid from './TimeSlotGrid';
import TurnoPicker from './TurnoPicker';
import AcessoriosDoPedido from './AcessoriosDoPedido';
import { listarRecursos } from '../../services/recursoService';
import {
  consultarOcupacao,
  consultarPendentesNoPeriodo,
  criarSolicitacao,
  lancarReserva,
} from '../../services/solicitacaoService';
import { listarUsuarios } from '../../services/usuarioService';
import { listarTurnos } from '../../services/turnoService';
import { periodoDoTurno } from '../../utils/turnos';
import { ESTADOS_RECURSO, recursoBloqueado } from '../../utils/estadoRecurso';

// Com `admin`, o modal vira "Nova reserva": o admin escolhe para quem é a
// reserva (ou uso institucional) e ela já é registrada como aprovada.
function RequestModal({ open, recursoInicial, admin = false, onClose, onCreated }) {
  const [form] = Form.useForm();
  const [recursos, setRecursos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [turnos, setTurnos] = useState([]);
  // Reservas guardadas junto com a combinação recurso/dia a que pertencem,
  // para não exibir dados de uma consulta anterior enquanto a nova carrega
  const [ocupacao, setOcupacao] = useState({ chave: null, lista: null });
  const [salvando, setSalvando] = useState(false);
  // Pedidos pendentes de outras pessoas no período escolhido (fila)
  const [fila, setFila] = useState({ chave: null, pendentes: 0 });

  const recursoId = Form.useWatch('recursoId', form);
  const data = Form.useWatch('data', form);
  const paraQuem = Form.useWatch('paraQuem', form);
  const horario = Form.useWatch('horario', form);
  const modo = Form.useWatch('modo', form);
  const turnoIds = Form.useWatch('turnoIds', form);
  const porTurno = modo === 'TURNO';
  const institucional = admin && paraQuem === 'INSTITUCIONAL';
  const recursoSelecionado = recursos.find((r) => r.id === recursoId);
  const chave = recursoId && data ? `${recursoId}-${data.valueOf()}` : null;
  const reservas = chave && ocupacao.chave === chave ? ocupacao.lista : null;

  // Período considerado para o estoque de acessórios: no modo turno, do início
  // do primeiro turno escolhido ao fim do último
  const periodoTurnos = useMemo(() => {
    if (!porTurno || !data || !turnoIds?.length) return null;
    const periodos = turnos.filter((t) => turnoIds.includes(t.id)).map((t) => periodoDoTurno(data, t));
    if (periodos.length === 0) return null;
    const inicio = periodos.reduce((m, [i]) => (i.isBefore(m) ? i : m), periodos[0][0]);
    const fim = periodos.reduce((m, [, f]) => (f.isAfter(m) ? f : m), periodos[0][1]);
    return [inicio, fim];
  }, [porTurno, data, turnoIds, turnos]);
  const periodo = porTurno ? periodoTurnos : horario;
  const chaveFila =
    !admin && recursoId && periodo ? `${recursoId}-${periodo[0].valueOf()}-${periodo[1].valueOf()}` : null;
  const pendentesNaFila = chaveFila && fila.chave === chaveFila ? fila.pendentes : 0;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ recursoId: recursoInicial, paraQuem: 'USUARIO', modo: 'TURNO' });
    listarTurnos()
      .then((lista) => {
        const ativos = lista.filter((t) => t.ativo);
        setTurnos(ativos);
        if (ativos.length === 0) form.setFieldValue('modo', 'HORARIO');
      })
      .catch(() => message.error('Erro ao carregar turnos.'));
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
  // ou a data invalida o horário e os turnos já marcados.
  useEffect(() => {
    form.setFieldsValue({ horario: undefined, turnoIds: [] });
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

  // O pedido não é bloqueado por outro pendente: entra na fila e o admin decide
  useEffect(() => {
    if (!chaveFila) return;
    let cancelado = false;
    consultarPendentesNoPeriodo(recursoId, periodo[0].toISOString(), periodo[1].toISOString())
      .then((pendentes) => !cancelado && setFila({ chave: chaveFila, pendentes }))
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [chaveFila, recursoId, periodo]);

  const salvar = async () => {
    const valores = await form.validateFields();

    const pedido = {
      recursoId: valores.recursoId,
      observacao: valores.observacao,
      acessorios: (valores.acessorios ?? []).map((id) => ({ id })),
      ...(porTurno
        ? { data: valores.data.format('YYYY-MM-DD'), turnoIds: valores.turnoIds }
        : {
            dataInicio: valores.horario[0].toISOString(),
            dataFim: valores.horario[1].toISOString(),
          }),
    };

    setSalvando(true);
    try {
      if (admin) {
        // Por turno a API devolve uma reserva por turno escolhido
        const resposta = await lancarReserva({
          ...pedido,
          institucional,
          usuarioId: institucional ? undefined : valores.usuarioId,
        });
        const reservas = [resposta].flat();
        message.success(
          reservas.length > 1
            ? `${reservas.length} reservas registradas e já aprovadas.`
            : 'Reserva registrada e já aprovada.'
        );
        const pendentes = reservas.reduce((soma, r) => soma + r.pendentesConflitantes, 0);
        if (pendentes > 0) {
          message.warning(
            `Há ${pendentes} solicitação(ões) pendente(s) nesse horário. Recuse-as em Aprovações.`,
            6
          );
        }
      } else {
        const criadas = [await criarSolicitacao(pedido)].flat();
        message.success(
          criadas.length > 1
            ? `${criadas.length} solicitações enviadas, uma por turno. Aguarde a aprovação do administrador.`
            : 'Solicitação enviada! Aguarde a aprovação do administrador.'
        );
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

        <Form.Item name="modo" label="Reservar">
          <Segmented
            block
            options={[
              { label: 'Por turno', value: 'TURNO', disabled: turnos.length === 0 },
              { label: 'Por horário', value: 'HORARIO' },
            ]}
          />
        </Form.Item>

        {porTurno ? (
          <Form.Item
            name="turnoIds"
            label="Turnos"
            extra="Marque um ou mais turnos. Cada turno vira um pedido separado."
            rules={[{ required: true, type: 'array', min: 1, message: 'Escolha pelo menos um turno.' }]}
          >
            <TurnoPicker data={chave ? data : null} reservas={reservas} turnos={turnos} />
          </Form.Item>
        ) : (
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
        )}

        {recursoSelecionado?.acessorios?.length > 0 && (
          <Form.Item name="acessorios" label="Itens que acompanham">
            <AcessoriosDoPedido recursoId={recursoId} periodo={periodo} />
          </Form.Item>
        )}

        {pendentesNaFila > 0 && (
          <Alert
            type="warning"
            showIcon
            className="request-fila-aviso"
            title={`Já há ${pendentesNaFila} pedido(s) aguardando aprovação neste horário.`}
            description={`Você pode enviar mesmo assim: seu pedido entra na fila como o ${pendentesNaFila + 1}º, e o administrador decide qual aprovar.`}
          />
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
