import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { ErroNegocio } from '../lib/erros';
import { dataNoFuso } from '../lib/fuso';
import { periodoDoTurno } from '../lib/turnos';
import { gerarDatas, validarSerie, type ParametrosSerie } from '../lib/recorrencia';
import { montarItensDoPedido, type ItemPedido } from '../lib/estoqueAcessorios';
import { validarPedido, aprovarPedido, buscarSemVaga } from './solicitacaoController';
import * as notificar from '../emails/notificacoes';
import type { DataRecusada } from '../emails/templates';

type ReqComId = Request<{ id: string }>;

// Dados da série usados nos e-mails
const incluirSerie = {
  usuario: { select: { nome: true, email: true } },
  recurso: { select: { nome: true, localizacao: true } },
  turno: { select: { nome: true } },
} as const;

type Falha = { status: number; error: string };

// Parâmetros da série vindos do corpo: por turno (turnoId) ou por horário
// (horaInicio/horaFim). Na série por turno, o horário é copiado do turno.
async function lerSerie(
  corpo: Record<string, unknown>
): Promise<({ ok: true; turnoId: string | null } & ParametrosSerie) | ({ ok: false } & Falha)> {
  let { horaInicio, horaFim } = corpo;
  let turnoId: string | null = null;

  if (corpo.turnoId !== undefined) {
    const turno = await prisma.turno.findFirst({ where: { id: String(corpo.turnoId), ativo: true } });
    if (!turno) return { ok: false, status: 400, error: 'Turno inválido ou desativado.' };
    ({ horaInicio, horaFim } = turno);
    turnoId = turno.id;
  }

  const parametros = {
    diasSemana: corpo.diasSemana,
    dataInicio: corpo.dataInicio,
    dataFim: corpo.dataFim,
    horaInicio,
    horaFim,
  };
  const erro = validarSerie(parametros);
  if (erro) return { ok: false, status: 400, error: erro };
  return { ok: true, turnoId, ...(parametros as ParametrosSerie) };
}

interface DataConferida {
  data: string;
  inicio: Date;
  fim: Date;
  ok: boolean;
  motivo?: string;
  itens?: ItemPedido[];
}

// Confere cada data da série como se fosse um pedido avulso (passado,
// conflito com reservas aprovadas, estado do recurso, acessórios)
async function conferirDatas(
  recursoId: string,
  serie: ParametrosSerie,
  acessorios: unknown
): Promise<{ ok: true; datas: DataConferida[] } | ({ ok: false } & Falha)> {
  const recurso = await prisma.recurso.findUnique({ where: { id: recursoId } });
  if (!recurso || !recurso.ativo) {
    return { ok: false, status: 404, error: 'Recurso não encontrado ou inativo.' };
  }
  // Acessório inválido falharia igual em todas as datas: é erro do pedido
  const montagem = await montarItensDoPedido(recursoId, acessorios);
  if (!montagem.ok) return { ok: false, status: 400, error: montagem.error };

  const datas: DataConferida[] = [];
  for (const data of gerarDatas(serie.dataInicio, serie.dataFim, serie.diasSemana)) {
    const { inicio, fim } = periodoDoTurno(data, serie);
    const validacao = await validarPedido(recursoId, inicio, fim, acessorios);
    datas.push(
      validacao.ok
        ? { data, inicio, fim, ok: true, itens: validacao.itens }
        : { data, inicio, fim, ok: false, motivo: validacao.error }
    );
  }
  return { ok: true, datas };
}

// Datas que a série geraria e se cada uma está disponível, para o professor
// conferir (e desmarcar feriados) antes de enviar
export async function previa(req: Request, res: Response) {
  try {
    const serie = await lerSerie(req.body);
    if (!serie.ok) return res.status(serie.status).json({ error: serie.error });

    const conferencia = await conferirDatas(String(req.body.recursoId ?? ''), serie, req.body.acessorios);
    if (!conferencia.ok) return res.status(conferencia.status).json({ error: conferencia.error });

    return res.json({
      datas: conferencia.datas.map(({ data, inicio, fim, ok, motivo }) => ({ data, inicio, fim, ok, motivo })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao conferir as datas da série.' });
  }
}

// Professor: cria a série e um pedido pendente para cada data disponível.
// Datas indisponíveis ficam de fora e são informadas; as que o professor
// desmarcou (ex.: feriados) vêm em ignorarDatas.
export async function criar(req: Request, res: Response) {
  const { recursoId, observacao, acessorios, ignorarDatas = [] } = req.body;

  if (req.usuario?.perfil === 'ADMIN') {
    return res.status(403).json({ error: 'Administradores registram reservas pela tela de Aprovações.' });
  }
  if (!Array.isArray(ignorarDatas) || ignorarDatas.some((d) => typeof d !== 'string')) {
    return res.status(400).json({ error: 'Envie as datas desmarcadas como lista.' });
  }

  try {
    const serie = await lerSerie(req.body);
    if (!serie.ok) return res.status(serie.status).json({ error: serie.error });

    const conferencia = await conferirDatas(String(recursoId ?? ''), serie, acessorios);
    if (!conferencia.ok) return res.status(conferencia.status).json({ error: conferencia.error });

    const escolhidas = conferencia.datas.filter((d) => !ignorarDatas.includes(d.data));
    const disponiveis = escolhidas.filter((d) => d.ok);
    const puladas: DataRecusada[] = escolhidas
      .filter((d) => !d.ok)
      .map((d) => ({ data: d.data, motivo: d.motivo! }));

    if (escolhidas.length === 0) {
      return res.status(400).json({ error: 'Todas as datas foram desmarcadas.' });
    }
    if (disponiveis.length === 0) {
      return res.status(409).json({ error: 'Nenhuma data da série está disponível.' });
    }

    const texto = typeof observacao === 'string' ? observacao.trim() || null : null;
    const recorrencia = await prisma.$transaction(async (tx) => {
      const criada = await tx.recorrencia.create({
        data: {
          usuarioId: req.usuario!.id,
          recursoId,
          turnoId: serie.turnoId,
          horaInicio: serie.horaInicio,
          horaFim: serie.horaFim,
          diasSemana: serie.diasSemana,
          dataInicio: serie.dataInicio,
          dataFim: serie.dataFim,
          observacao: texto,
        },
        include: incluirSerie,
      });
      for (const d of disponiveis) {
        await tx.solicitacao.create({
          data: {
            recursoId,
            usuarioId: req.usuario!.id,
            dataInicio: d.inicio,
            dataFim: d.fim,
            turnoId: serie.turnoId,
            recorrenciaId: criada.id,
            observacao: texto,
            acessorios: { create: d.itens ?? [] },
          },
        });
      }
      return criada;
    });

    notificar.serieCriada(recorrencia, disponiveis.length, puladas);
    return res.status(201).json({ recorrencia, criadas: disponiveis.length, puladas });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao criar a série.' });
  }
}

// Admin: aprova de uma vez as datas pendentes da série. Cada data passa pelas
// mesmas regras da aprovação individual; as que falham continuam pendentes e
// são listadas, junto com pedidos de outros professores que ficaram sem vaga.
export async function aprovar(req: ReqComId, res: Response) {
  try {
    const recorrencia = await prisma.recorrencia.findUnique({
      where: { id: req.params.id },
      include: {
        ...incluirSerie,
        solicitacoes: { where: { status: 'PENDENTE' }, orderBy: { dataInicio: 'asc' } },
      },
    });
    if (!recorrencia) return res.status(404).json({ error: 'Série não encontrada.' });
    if (recorrencia.solicitacoes.length === 0) {
      return res.status(409).json({ error: 'A série não tem datas pendentes.' });
    }

    const aprovadas = [];
    const falhas: DataRecusada[] = [];
    for (const s of recorrencia.solicitacoes) {
      try {
        aprovadas.push(await aprovarPedido(s.id, req.usuario!.id));
      } catch (error) {
        if (!(error instanceof ErroNegocio)) throw error;
        falhas.push({ data: dataNoFuso(s.dataInicio), motivo: error.message });
      }
    }

    const semVaga = new Map();
    for (const a of aprovadas) {
      for (const s of await buscarSemVaga(a)) semVaga.set(s.id, s);
    }

    notificar.serieAprovada(recorrencia, aprovadas.length, falhas);
    return res.json({ aprovadas: aprovadas.length, falhas, semVaga: [...semVaga.values()] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao aprovar a série.' });
  }
}

// Admin: recusa todas as datas ainda pendentes da série
export async function recusar(req: ReqComId, res: Response) {
  const motivo = String(req.body?.motivo ?? '').trim() || null;

  try {
    const recorrencia = await prisma.recorrencia.findUnique({
      where: { id: req.params.id },
      include: incluirSerie,
    });
    if (!recorrencia) return res.status(404).json({ error: 'Série não encontrada.' });

    const { count } = await prisma.solicitacao.updateMany({
      where: { recorrenciaId: recorrencia.id, status: 'PENDENTE' },
      data: { status: 'RECUSADA', aprovadoPorId: req.usuario!.id, motivoRecusa: motivo },
    });
    if (count === 0) return res.status(409).json({ error: 'A série não tem datas pendentes.' });

    notificar.serieRecusada(recorrencia, count, motivo);
    return res.json({ recusadas: count });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao recusar a série.' });
  }
}

// Professor: desiste da série. Datas pendentes são excluídas; reservas
// aprovadas que ainda não começaram são canceladas. O que já começou ou
// terminou fica como está.
export async function cancelar(req: ReqComId, res: Response) {
  try {
    const recorrencia = await prisma.recorrencia.findUnique({
      where: { id: req.params.id },
      include: incluirSerie,
    });
    if (!recorrencia || recorrencia.usuarioId !== req.usuario!.id) {
      return res.status(404).json({ error: 'Série não encontrada.' });
    }

    const [removidas, canceladas] = await prisma.$transaction([
      prisma.solicitacao.deleteMany({ where: { recorrenciaId: recorrencia.id, status: 'PENDENTE' } }),
      prisma.solicitacao.updateMany({
        where: { recorrenciaId: recorrencia.id, status: 'APROVADA', dataInicio: { gt: new Date() } },
        data: { status: 'CANCELADA', canceladoEm: new Date() },
      }),
    ]);

    notificar.serieCanceladaPeloProfessor(recorrencia, canceladas.count);
    return res.json({ removidas: removidas.count, canceladas: canceladas.count });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao cancelar a série.' });
  }
}
