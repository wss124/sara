import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { violouSobreposicao, ErroNegocio } from '../lib/erros';
import {
  acessoriosEmFalta,
  montarItensDoPedido,
  travarAcessorios,
  type ItemPedido,
} from '../lib/estoqueAcessorios';
import {
  STATUS_SOLICITACAO,
  STATUS_OCUPANTES,
  ANTECEDENCIA_RETIRADA_MIN,
  estaAtrasada,
} from '../lib/status';
import type { StatusSolicitacao, CondicaoDevolucao } from '../generated/prisma/enums';
import * as notificar from '../emails/notificacoes';
import { diaValido, periodoDoTurno } from '../lib/turnos';
import { montarFila } from '../lib/fila';

const CONDICOES_DEVOLUCAO = ['OK', 'COM_DEFEITO', 'INCOMPLETO'];

// Lista de ids enviada no corpo; ausente vira lista vazia, formato inválido
// vira undefined
function listaDeIds(valor: unknown): string[] | undefined {
  if (valor === undefined) return [];
  if (!Array.isArray(valor) || valor.some((v) => typeof v !== 'string')) return undefined;
  return valor;
}

type ReqComId = Request<{ id: string }>;

export const incluirDetalhes = {
  recurso: { select: { id: true, nome: true, tipo: true, localizacao: true } },
  usuario: { select: { id: true, nome: true, email: true, perfil: true } },
  aprovadoPor: { select: { id: true, nome: true } },
  lancadoPor: { select: { id: true, nome: true } },
  retiradaRegistradaPor: { select: { id: true, nome: true } },
  devolucaoRegistradaPor: { select: { id: true, nome: true } },
  acessorios: {
    include: { acessorio: { select: { id: true, nome: true, localizacao: true } } },
  },
  turno: { select: { id: true, nome: true } },
  recorrencia: {
    select: { id: true, diasSemana: true, dataInicio: true, dataFim: true, horaInicio: true, horaFim: true },
  },
} as const;

function mensagemEmFalta(nomes: string[]) {
  return `Sem unidades livres nesse horário: ${nomes.join(', ')}.`;
}

// Dentro da transação: trava os acessórios e confere se ainda há unidades
// livres para o período. Lança ErroNegocio se faltar algum.
async function garantirAcessorios(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  itens: ItemPedido[],
  inicio: Date,
  fim: Date,
  ignorarSolicitacaoId?: string
) {
  await travarAcessorios(tx, itens.map((i) => i.acessorioId));
  const emFalta = await acessoriosEmFalta(tx, itens, inicio, fim, ignorarSolicitacaoId);
  if (emFalta.length > 0) throw new ErroNegocio(409, mensagemEmFalta(emFalta));
}

function parseData(valor: unknown) {
  const data = new Date(String(valor));
  return Number.isNaN(data.getTime()) ? null : data;
}

// Procura uma reserva ativa (aprovada ou em uso) do mesmo recurso cujo período
// se sobrepõe ao informado (início < fim existente e fim > início existente).
function buscarConflito(recursoId: string, inicio: Date, fim: Date, ignorarId?: string) {
  return prisma.solicitacao.findFirst({
    where: {
      recursoId,
      status: { in: STATUS_OCUPANTES },
      dataInicio: { lt: fim },
      dataFim: { gt: inicio },
      ...(ignorarId ? { id: { not: ignorarId } } : {}),
    },
  });
}

// Reservas aprovadas ainda não iniciadas de um recurso. Usado quando ele
// entra em manutenção, para o admin avisar ou cancelar quem seria afetado.
export function buscarReservasFuturas(recursoId: string) {
  return prisma.solicitacao.findMany({
    where: { recursoId, status: 'APROVADA', dataFim: { gt: new Date() } },
    include: incluirDetalhes,
    orderBy: { dataInicio: 'asc' },
  });
}

// Estados em que o recurso não aceita novos pedidos nem aprovações
const MOTIVO_BLOQUEIO: Partial<Record<string, string>> = {
  EM_MANUTENCAO: 'O recurso está em manutenção e não pode ser reservado no momento.',
  INDISPONIVEL: 'O recurso está indisponível e não pode ser reservado no momento.',
};

// Validações comuns à solicitação do usuário e à reserva lançada pelo admin.
// Devolve o período já convertido ou a mensagem de erro com o status HTTP.
type ResultadoValidacao =
  | { ok: true; inicio: Date; fim: Date; itens: ItemPedido[] }
  | { ok: false; status: number; error: string };

export async function validarPedido(
  recursoId: unknown,
  inicio: Date | null,
  fim: Date | null,
  acessorios?: unknown
): Promise<ResultadoValidacao> {
  if (!recursoId || !inicio || !fim) {
    return { ok: false, status: 400, error: 'Informe o recurso, a data de início e a data de fim.' };
  }
  if (fim <= inicio) {
    return { ok: false, status: 400, error: 'O horário de fim deve ser depois do início.' };
  }
  if (inicio < new Date()) {
    return { ok: false, status: 400, error: 'Não é possível reservar um horário no passado.' };
  }

  const recurso = await prisma.recurso.findUnique({ where: { id: String(recursoId) } });
  if (!recurso || !recurso.ativo) {
    return { ok: false, status: 404, error: 'Recurso não encontrado ou inativo.' };
  }
  const bloqueio = MOTIVO_BLOQUEIO[recurso.estado];
  if (bloqueio) {
    return { ok: false, status: 409, error: bloqueio };
  }
  if (await buscarConflito(recurso.id, inicio, fim)) {
    return { ok: false, status: 409, error: 'O recurso já está reservado nesse horário.' };
  }

  const montagem = await montarItensDoPedido(recurso.id, acessorios);
  if (!montagem.ok) {
    return { ok: false, status: 400, error: montagem.error };
  }
  const emFalta = await acessoriosEmFalta(prisma, montagem.itens, inicio, fim);
  if (emFalta.length > 0) {
    return { ok: false, status: 409, error: mensagemEmFalta(emFalta) };
  }

  return { ok: true, inicio, fim, itens: montagem.itens };
}

interface Periodo {
  inicio: Date | null;
  fim: Date | null;
  turno: { id: string; nome: string } | null;
}

type ResultadoPeriodos =
  | { ok: true; periodos: Periodo[]; porTurno: boolean }
  | { ok: false; status: number; error: string };

// O pedido chega por horário ({ dataInicio, dataFim }) ou por turno
// ({ data: "2026-10-14", turnoIds: [...] }). Cada turno vira um período
// próprio, convertido com os horários atuais do turno no fuso do campus.
async function resolverPeriodos(corpo: Record<string, unknown>): Promise<ResultadoPeriodos> {
  if (corpo.turnoIds === undefined) {
    return {
      ok: true,
      porTurno: false,
      periodos: [{ inicio: parseData(corpo.dataInicio), fim: parseData(corpo.dataFim), turno: null }],
    };
  }

  const ids = listaDeIds(corpo.turnoIds);
  if (!ids || ids.length === 0 || new Set(ids).size !== ids.length) {
    return { ok: false, status: 400, error: 'Escolha um ou mais turnos, sem repetir.' };
  }
  if (!diaValido(corpo.data)) {
    return { ok: false, status: 400, error: 'Informe a data no formato AAAA-MM-DD.' };
  }
  const dia = corpo.data;

  const turnos = await prisma.turno.findMany({
    where: { id: { in: ids }, ativo: true },
    orderBy: { horaInicio: 'asc' },
  });
  if (turnos.length !== ids.length) {
    return { ok: false, status: 400, error: 'Turno inválido ou desativado.' };
  }

  return {
    ok: true,
    porTurno: true,
    periodos: turnos.map((t) => ({ ...periodoDoTurno(dia, t), turno: { id: t.id, nome: t.nome } })),
  };
}

interface PedidoValidado {
  inicio: Date;
  fim: Date;
  itens: ItemPedido[];
  turnoId: string | null;
}

// Valida todos os períodos do pedido. Basta um falhar para nada ser criado;
// no pedido por turno, a mensagem diz qual turno teve problema.
async function validarPeriodos(
  recursoId: unknown,
  periodos: Periodo[],
  acessorios: unknown
): Promise<{ ok: true; pedidos: PedidoValidado[] } | { ok: false; status: number; error: string }> {
  const pedidos: PedidoValidado[] = [];
  for (const periodo of periodos) {
    const validacao = await validarPedido(recursoId, periodo.inicio, periodo.fim, acessorios);
    if (!validacao.ok) {
      const prefixo = periodo.turno ? `${periodo.turno.nome}: ` : '';
      return { ...validacao, error: prefixo + validacao.error };
    }
    pedidos.push({
      inicio: validacao.inicio,
      fim: validacao.fim,
      itens: validacao.itens,
      turnoId: periodo.turno?.id ?? null,
    });
  }
  return { ok: true, pedidos };
}

export async function criar(req: Request, res: Response) {
  const { recursoId, observacao, acessorios } = req.body;

  // O admin não pede para si mesmo: ele lança reservas já aprovadas
  if (req.usuario?.perfil === 'ADMIN') {
    return res.status(403).json({
      error: 'Administradores registram reservas pela tela de Aprovações.',
    });
  }

  try {
    const resolvidos = await resolverPeriodos(req.body);
    if (!resolvidos.ok) {
      return res.status(resolvidos.status).json({ error: resolvidos.error });
    }
    const validacao = await validarPeriodos(recursoId, resolvidos.periodos, acessorios);
    if (!validacao.ok) {
      return res.status(validacao.status).json({ error: validacao.error });
    }

    // Manhã + tarde viram dois pedidos, aprovados ou cancelados separadamente
    const solicitacoes = await prisma.$transaction(
      validacao.pedidos.map((p) =>
        prisma.solicitacao.create({
          data: {
            recursoId,
            usuarioId: req.usuario!.id,
            dataInicio: p.inicio,
            dataFim: p.fim,
            turnoId: p.turnoId,
            observacao: observacao?.trim() || null,
            acessorios: { create: p.itens },
          },
          include: incluirDetalhes,
        })
      )
    );

    solicitacoes.forEach((s) => notificar.pedidoCriado(s));
    // Por turno a resposta é sempre uma lista; por horário, o pedido único
    return res.status(201).json(resolvidos.porTurno ? solicitacoes : solicitacoes[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao criar solicitação.' });
  }
}

// Admin: registra uma reserva já aprovada, em nome de um usuário cadastrado
// ou como uso institucional (prova, reunião, evento).
export async function reservar(req: Request, res: Response) {
  const { recursoId, observacao, usuarioId, institucional, acessorios } = req.body;
  const adminId = req.usuario!.id;

  if (institucional && !observacao?.trim()) {
    return res.status(400).json({ error: 'Descreva a finalidade do uso institucional.' });
  }
  if (!institucional && !usuarioId) {
    return res.status(400).json({ error: 'Informe para quem é a reserva.' });
  }

  try {
    if (!institucional) {
      const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
      if (!usuario || usuario.perfil === 'ADMIN') {
        return res.status(400).json({ error: 'Usuário inválido para a reserva.' });
      }
    }

    const resolvidos = await resolverPeriodos(req.body);
    if (!resolvidos.ok) {
      return res.status(resolvidos.status).json({ error: resolvidos.error });
    }
    const validacao = await validarPeriodos(recursoId, resolvidos.periodos, acessorios);
    if (!validacao.ok) {
      return res.status(validacao.status).json({ error: validacao.error });
    }

    const reservas = await prisma.$transaction(async (tx) => {
      const criadas = [];
      for (const p of validacao.pedidos) {
        await garantirAcessorios(tx, p.itens, p.inicio, p.fim);
        criadas.push(
          await tx.solicitacao.create({
            data: {
              recursoId,
              usuarioId: institucional ? adminId : usuarioId,
              dataInicio: p.inicio,
              dataFim: p.fim,
              turnoId: p.turnoId,
              observacao: observacao?.trim() || null,
              status: 'APROVADA',
              institucional: Boolean(institucional),
              lancadoPorId: adminId,
              aprovadoPorId: adminId,
              acessorios: { create: p.itens },
            },
            include: incluirDetalhes,
          })
        );
      }
      return criadas;
    });

    // Pedidos pendentes no mesmo horário agora vão colidir na aprovação;
    // o front avisa o admin para recusá-los.
    const comPendentes = await Promise.all(
      reservas.map(async (reserva) => ({
        ...reserva,
        pendentesConflitantes: await prisma.solicitacao.count({
          where: {
            recursoId,
            status: 'PENDENTE',
            dataInicio: { lt: reserva.dataFim },
            dataFim: { gt: reserva.dataInicio },
          },
        }),
      }))
    );

    reservas.forEach((r) => notificar.reservaLancada(r));
    return res.status(201).json(resolvidos.porTurno ? comPendentes : comPendentes[0]);
  } catch (error) {
    if (error instanceof ErroNegocio) {
      return res.status(error.status).json({ error: error.message });
    }
    if (violouSobreposicao(error)) {
      return res.status(409).json({ error: 'O recurso já está reservado nesse horário.' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Erro ao registrar reserva.' });
  }
}

// Admin: desfaz uma reserva lançada por ele (ou outro admin) que ainda não terminou
export async function cancelarReserva(req: ReqComId, res: Response) {
  const { id } = req.params;

  try {
    const reserva = await prisma.solicitacao.findUnique({ where: { id }, include: incluirDetalhes });

    if (!reserva || !reserva.lancadoPorId) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }
    if (reserva.status !== 'APROVADA' || reserva.dataFim < new Date()) {
      return res.status(409).json({ error: 'Esta reserva já foi retirada ou encerrada.' });
    }

    await prisma.solicitacao.delete({ where: { id } });
    notificar.canceladaPeloAdmin(reserva, null);
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao cancelar reserva.' });
  }
}

// Fila de todos os pedidos pendentes, para indicar quem chegou primeiro entre
// os que disputam o mesmo recurso e horário
async function filaDosPendentes() {
  const pendentes = await prisma.solicitacao.findMany({
    where: { status: 'PENDENTE' },
    select: {
      id: true,
      recursoId: true,
      dataInicio: true,
      dataFim: true,
      criadoEm: true,
      usuario: { select: { nome: true } },
    },
  });
  return montarFila(pendentes);
}

export async function listarMinhas(req: Request, res: Response) {
  try {
    const [solicitacoes, fila] = await Promise.all([
      prisma.solicitacao.findMany({
        where: { usuarioId: req.usuario!.id },
        include: incluirDetalhes,
        orderBy: { dataInicio: 'desc' },
      }),
      filaDosPendentes(),
    ]);

    // O professor vê só a própria posição, sem saber quem são os outros
    return res.json(
      solicitacoes.map((s) => {
        const posicao = fila.get(s.id);
        return { ...s, fila: posicao ? { posicao: posicao.posicao, total: posicao.total } : null };
      })
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao listar solicitações.' });
  }
}

// Admin: todas as solicitações, com filtro opcional por status
export async function listarTodas(req: Request, res: Response) {
  const { status } = req.query;

  if (status && !STATUS_SOLICITACAO.includes(status as StatusSolicitacao)) {
    return res.status(400).json({ error: 'Status inválido.' });
  }

  try {
    const [solicitacoes, fila] = await Promise.all([
      prisma.solicitacao.findMany({
        where: status ? { status: status as StatusSolicitacao } : {},
        include: incluirDetalhes,
        orderBy: { dataInicio: 'asc' },
      }),
      filaDosPendentes(),
    ]);

    return res.json(
      solicitacoes.map((s) => {
        const posicao = fila.get(s.id);
        return {
          ...s,
          fila: posicao
            ? {
                posicao: posicao.posicao,
                total: posicao.total,
                concorrentes: posicao.concorrentes.map((c) => ({
                  id: c.id,
                  criadoEm: c.criadoEm,
                  usuario: c.usuario,
                })),
              }
            : null,
        };
      })
    );
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao listar solicitações.' });
  }
}

// Horários já reservados (aprovados ou em uso) de um recurso num intervalo,
// usado pelo formulário para mostrar a disponibilidade antes de solicitar.
export async function ocupacao(req: Request, res: Response) {
  const { recursoId } = req.query;
  const inicio = parseData(req.query.inicio);
  const fim = parseData(req.query.fim);

  if (!recursoId || !inicio || !fim) {
    return res.status(400).json({ error: 'Informe recursoId, inicio e fim.' });
  }

  try {
    const reservas = await prisma.solicitacao.findMany({
      where: {
        recursoId: String(recursoId),
        status: { in: STATUS_OCUPANTES },
        dataInicio: { lt: fim },
        dataFim: { gt: inicio },
      },
      select: { id: true, dataInicio: true, dataFim: true },
      orderBy: { dataInicio: 'asc' },
    });

    return res.json(reservas);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao consultar ocupação.' });
  }
}

// Quantos pedidos pendentes já disputam o período, para o professor saber
// antes de enviar que entrará numa fila
export async function pendentesNoPeriodo(req: Request, res: Response) {
  const { recursoId } = req.query;
  const inicio = parseData(req.query.inicio);
  const fim = parseData(req.query.fim);

  if (!recursoId || !inicio || !fim) {
    return res.status(400).json({ error: 'Informe recursoId, inicio e fim.' });
  }

  try {
    const pendentes = await prisma.solicitacao.count({
      where: {
        recursoId: String(recursoId),
        status: 'PENDENTE',
        dataInicio: { lt: fim },
        dataFim: { gt: inicio },
      },
    });
    return res.json({ pendentes });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao consultar pedidos pendentes.' });
  }
}

const MENSAGEM_JA_APROVADA = 'Já existe uma reserva aprovada nesse horário. Recuse esta solicitação.';

// Aprova um pedido pendente. Lança ErroNegocio quando não é possível (recurso
// bloqueado, horário ou acessórios já comprometidos). Usada na aprovação
// individual e na aprovação de uma série inteira.
export async function aprovarPedido(id: string, adminId: string) {
  const solicitacao = await prisma.solicitacao.findUnique({
    where: { id },
    include: { recurso: { select: { estado: true } }, acessorios: true },
  });

  if (!solicitacao) {
    throw new ErroNegocio(404, 'Solicitação não encontrada.');
  }
  if (solicitacao.status !== 'PENDENTE') {
    throw new ErroNegocio(409, 'Apenas solicitações pendentes podem ser aprovadas.');
  }
  const bloqueio = MOTIVO_BLOQUEIO[solicitacao.recurso.estado];
  if (bloqueio) {
    throw new ErroNegocio(409, bloqueio);
  }

  // Outra solicitação pode ter sido aprovada para o mesmo horário depois desta
  // ser criada. A checagem dá uma mensagem clara; a constraint do banco cobre
  // o caso de duas aprovações simultâneas, que passariam ambas por aqui.
  const conflito = await buscarConflito(
    solicitacao.recursoId,
    solicitacao.dataInicio,
    solicitacao.dataFim,
    solicitacao.id
  );
  if (conflito) {
    throw new ErroNegocio(409, MENSAGEM_JA_APROVADA);
  }

  try {
    // Os acessórios podem ter sido comprometidos com outra reserva aprovada
    // depois que este pedido foi feito
    return await prisma.$transaction(async (tx) => {
      await garantirAcessorios(
        tx,
        solicitacao.acessorios,
        solicitacao.dataInicio,
        solicitacao.dataFim,
        solicitacao.id
      );
      return tx.solicitacao.update({
        where: { id },
        data: { status: 'APROVADA', aprovadoPorId: adminId },
        include: incluirDetalhes,
      });
    });
  } catch (error) {
    if (violouSobreposicao(error)) throw new ErroNegocio(409, MENSAGEM_JA_APROVADA);
    throw error;
  }
}

// Pedidos pendentes que disputavam o horário de uma reserva recém-aprovada e
// agora não têm mais vaga. A decisão de recusá-los fica com o admin.
export function buscarSemVaga(reserva: { recursoId: string; dataInicio: Date; dataFim: Date }) {
  return prisma.solicitacao.findMany({
    where: {
      recursoId: reserva.recursoId,
      status: 'PENDENTE',
      dataInicio: { lt: reserva.dataFim },
      dataFim: { gt: reserva.dataInicio },
    },
    include: incluirDetalhes,
    orderBy: { criadoEm: 'asc' },
  });
}

export async function aprovar(req: ReqComId, res: Response) {
  try {
    const atualizada = await aprovarPedido(req.params.id, req.usuario!.id);
    const semVaga = await buscarSemVaga(atualizada);

    notificar.pedidoAprovado(atualizada);
    return res.json({ ...atualizada, semVaga });
  } catch (error) {
    if (error instanceof ErroNegocio) {
      return res.status(error.status).json({ error: error.message });
    }
    console.error(error);
    return res.status(500).json({ error: 'Erro ao aprovar solicitação.' });
  }
}

// Admin: recusa um pedido, com motivo opcional mostrado ao professor
export async function recusar(req: ReqComId, res: Response) {
  const { id } = req.params;
  const motivo = String(req.body?.motivo ?? '').trim() || null;

  try {
    const solicitacao = await prisma.solicitacao.findUnique({ where: { id } });

    if (!solicitacao) {
      return res.status(404).json({ error: 'Solicitação não encontrada.' });
    }
    if (solicitacao.status !== 'PENDENTE') {
      return res.status(409).json({ error: 'Apenas solicitações pendentes podem ser recusadas.' });
    }

    const atualizada = await prisma.solicitacao.update({
      where: { id },
      data: { status: 'RECUSADA', aprovadoPorId: req.usuario!.id, motivoRecusa: motivo },
      include: incluirDetalhes,
    });

    notificar.pedidoRecusado(atualizada, motivo);
    return res.json(atualizada);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao recusar solicitação.' });
  }
}

// O próprio usuário desiste do pedido: uma solicitação pendente é excluída;
// uma reserva aprovada ainda não retirada é marcada como CANCELADA, para
// manter o histórico e liberar o horário.
export async function cancelar(req: ReqComId, res: Response) {
  const { id } = req.params;

  try {
    const solicitacao = await prisma.solicitacao.findUnique({ where: { id } });

    if (!solicitacao || solicitacao.usuarioId !== req.usuario!.id) {
      return res.status(404).json({ error: 'Solicitação não encontrada.' });
    }

    if (solicitacao.status === 'PENDENTE') {
      await prisma.solicitacao.delete({ where: { id } });
      return res.status(204).send();
    }

    if (solicitacao.status === 'APROVADA' && solicitacao.dataFim > new Date()) {
      const cancelada = await prisma.solicitacao.update({
        where: { id },
        data: { status: 'CANCELADA', canceladoEm: new Date() },
        include: incluirDetalhes,
      });
      notificar.canceladaPeloProfessor(cancelada);
      return res.json(cancelada);
    }

    return res.status(409).json({
      error: 'Só é possível cancelar pedidos pendentes ou reservas aprovadas ainda não retiradas.',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao cancelar solicitação.' });
  }
}

// Admin: cancela uma reserva aprovada de qualquer professor (ex.: recurso foi
// para manutenção). O motivo fica registrado e é mostrado ao professor.
export async function cancelarPeloAdmin(req: ReqComId, res: Response) {
  const { id } = req.params;
  const motivo = String(req.body?.motivo ?? '').trim();

  if (!motivo) {
    return res.status(400).json({ error: 'Informe o motivo do cancelamento.' });
  }

  try {
    const reserva = await prisma.solicitacao.findUnique({ where: { id } });

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }
    if (reserva.status !== 'APROVADA' && reserva.status !== 'PENDENTE') {
      return res.status(409).json({
        error: 'Só é possível cancelar pedidos pendentes ou reservas ainda não retiradas.',
      });
    }

    const cancelada = await prisma.solicitacao.update({
      where: { id },
      data: { status: 'CANCELADA', canceladoEm: new Date(), motivoCancelamento: motivo },
      include: incluirDetalhes,
    });

    notificar.canceladaPeloAdmin(cancelada, motivo);
    return res.json(cancelada);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao cancelar a reserva.' });
  }
}

// Admin: entrega o recurso ao responsável. A reserva passa a EM_ANDAMENTO e o
// recurso a EM_USO, na mesma transação.
export async function registrarRetirada(req: ReqComId, res: Response) {
  const { id } = req.params;
  const agora = new Date();
  const conferidos = listaDeIds(req.body?.itensConferidos);
  const observacao = String(req.body?.observacao ?? '').trim();

  if (!conferidos) {
    return res.status(400).json({ error: 'Envie os acessórios conferidos como lista de ids.' });
  }

  try {
    const reserva = await prisma.solicitacao.findUnique({
      where: { id },
      include: { recurso: true, acessorios: { include: { acessorio: true } } },
    });

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }
    if (reserva.status !== 'APROVADA') {
      return res.status(409).json({ error: 'Apenas reservas aprovadas podem ser retiradas.' });
    }

    const liberadaEm = new Date(reserva.dataInicio.getTime() - ANTECEDENCIA_RETIRADA_MIN * 60_000);
    if (agora < liberadaEm) {
      return res.status(409).json({
        error: `A retirada só pode ser registrada a partir de ${ANTECEDENCIA_RETIRADA_MIN} minutos antes do início.`,
      });
    }
    if (agora >= reserva.dataFim) {
      return res.status(409).json({ error: 'O horário desta reserva já terminou.' });
    }
    if (reserva.recurso.estado === 'EM_USO') {
      return res.status(409).json({ error: 'O recurso ainda não foi devolvido pelo uso anterior.' });
    }
    if (reserva.recurso.estado !== 'DISPONIVEL') {
      return res.status(409).json({ error: 'O recurso está em manutenção ou indisponível.' });
    }

    // Checklist: todo acessório da reserva deve ser conferido na entrega,
    // ou a falta precisa ser justificada
    const naoEntregues = reserva.acessorios.filter((i) => !conferidos.includes(i.acessorioId));
    if (naoEntregues.length > 0 && !observacao) {
      return res.status(400).json({
        error: `Confira todos os itens ou justifique o que não foi entregue: ${naoEntregues
          .map((i) => i.acessorio.nome)
          .join(', ')}.`,
      });
    }

    const [, atualizada] = await prisma.$transaction([
      prisma.solicitacaoAcessorio.updateMany({
        where: { solicitacaoId: id, acessorioId: { in: conferidos } },
        data: { entregue: true },
      }),
      prisma.solicitacao.update({
        where: { id },
        data: {
          status: 'EM_ANDAMENTO',
          retiradoEm: agora,
          retiradaRegistradaPorId: req.usuario!.id,
          observacaoRetirada: observacao || null,
        },
        include: incluirDetalhes,
      }),
      prisma.recurso.update({ where: { id: reserva.recursoId }, data: { estado: 'EM_USO' } }),
    ]);

    return res.json(atualizada);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao registrar a retirada.' });
  }
}

// Admin: recebe o recurso de volta e informa como ele voltou. Com defeito, o
// recurso vai para manutenção e a resposta lista as reservas futuras afetadas
// para o admin decidir o que fazer. Uma devolução antecipada libera o
// restante do horário.
export async function registrarDevolucao(req: ReqComId, res: Response) {
  const { id } = req.params;
  let condicao = req.body?.condicao ?? 'OK';
  let observacao = String(req.body?.observacao ?? '').trim();
  // Sem checklist, considera que tudo o que foi entregue voltou
  const devolvidos =
    req.body?.itensDevolvidos === undefined ? null : listaDeIds(req.body.itensDevolvidos);

  if (!CONDICOES_DEVOLUCAO.includes(condicao)) {
    return res.status(400).json({ error: 'Condição inválida: use OK, COM_DEFEITO ou INCOMPLETO.' });
  }
  if (devolvidos === undefined) {
    return res.status(400).json({ error: 'Envie os acessórios devolvidos como lista de ids.' });
  }

  try {
    const reserva = await prisma.solicitacao.findUnique({
      where: { id },
      include: { acessorios: { include: { acessorio: true } } },
    });

    if (!reserva) {
      return res.status(404).json({ error: 'Reserva não encontrada.' });
    }
    if (reserva.status !== 'EM_ANDAMENTO') {
      return res.status(409).json({ error: 'Apenas recursos retirados podem ser devolvidos.' });
    }

    // Item entregue que não voltou deixa a devolução incompleta e sai do
    // estoque até o admin regularizar
    const entregues = reserva.acessorios.filter((i) => i.entregue);
    const faltando = devolvidos ? entregues.filter((i) => !devolvidos.includes(i.acessorioId)) : [];
    if (faltando.length > 0) {
      if (condicao === 'OK') condicao = 'INCOMPLETO';
      if (!observacao) {
        observacao = `Não devolvido: ${faltando.map((i) => i.acessorio.nome).join(', ')}.`;
      }
    }
    if (condicao !== 'OK' && !observacao) {
      return res.status(400).json({ error: 'Descreva o problema encontrado na devolução.' });
    }
    const idsFaltando = faltando.map((i) => i.acessorioId);

    // A solicitação é gravada por último para a resposta já trazer o checklist
    const atualizada = await prisma.$transaction(async (tx) => {
      await tx.solicitacaoAcessorio.updateMany({
        where: { solicitacaoId: id, entregue: true, acessorioId: { notIn: idsFaltando } },
        data: { devolvido: true },
      });
      await tx.solicitacaoAcessorio.updateMany({
        where: { solicitacaoId: id, acessorioId: { in: idsFaltando } },
        data: { devolvido: false },
      });
      for (const item of faltando) {
        await tx.acessorio.update({
          where: { id: item.acessorioId },
          data: { emFalta: { increment: item.quantidade } },
        });
      }
      await tx.recurso.update({
        where: { id: reserva.recursoId },
        data: { estado: condicao === 'COM_DEFEITO' ? 'EM_MANUTENCAO' : 'DISPONIVEL' },
      });
      return tx.solicitacao.update({
        where: { id },
        data: {
          status: 'CONCLUIDA',
          devolvidoEm: new Date(),
          devolucaoRegistradaPorId: req.usuario!.id,
          condicaoDevolucao: condicao as CondicaoDevolucao,
          observacaoDevolucao: observacao || null,
        },
        include: incluirDetalhes,
      });
    });

    const reservasAfetadas =
      condicao === 'COM_DEFEITO' ? await buscarReservasFuturas(reserva.recursoId) : [];
    notificar.recursoForaDeUso(reservasAfetadas, 'EM_MANUTENCAO');

    return res.json({ ...atualizada, reservasAfetadas });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao registrar a devolução.' });
  }
}

// Admin: painel do balcão. Reservas do dia aguardando retirada, tudo o que está
// com alguém agora (inclusive atrasos de dias anteriores) e as devoluções de hoje.
export async function movimentacoes(req: Request, res: Response) {
  const agora = new Date();
  const inicioDoDia = new Date(agora);
  inicioDoDia.setHours(0, 0, 0, 0);
  const fimDoDia = new Date(inicioDoDia);
  fimDoDia.setDate(fimDoDia.getDate() + 1);

  try {
    const [aguardandoRetirada, emUso, devolvidasHoje] = await Promise.all([
      prisma.solicitacao.findMany({
        where: { status: 'APROVADA', dataInicio: { lt: fimDoDia }, dataFim: { gt: agora } },
        include: incluirDetalhes,
        orderBy: { dataInicio: 'asc' },
      }),
      prisma.solicitacao.findMany({
        where: { status: 'EM_ANDAMENTO' },
        include: incluirDetalhes,
        orderBy: { dataFim: 'asc' },
      }),
      prisma.solicitacao.findMany({
        where: { status: 'CONCLUIDA', devolvidoEm: { gte: inicioDoDia } },
        include: incluirDetalhes,
        orderBy: { devolvidoEm: 'desc' },
      }),
    ]);

    return res.json({
      geradoEm: agora,
      aguardandoRetirada,
      emUso: emUso.map((r) => ({ ...r, atrasada: estaAtrasada(r, agora) })),
      devolvidasHoje,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao carregar retiradas e devoluções.' });
  }
}
