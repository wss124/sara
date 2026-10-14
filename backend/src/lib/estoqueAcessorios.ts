import { Prisma } from '../generated/prisma/client';
import { prisma } from './prisma';
import { STATUS_OCUPANTES } from './status';

type Db = typeof prisma | Prisma.TransactionClient;

export interface ItemPedido {
  acessorioId: string;
  quantidade: number;
}

// Unidades livres de cada acessório num período: o total cadastrado menos o
// que já está comprometido com reservas ativas (aprovadas ou em uso) que se
// sobrepõem ao período.
export async function unidadesLivres(
  db: Db,
  acessorioIds: string[],
  inicio: Date,
  fim: Date,
  ignorarSolicitacaoId?: string
) {
  if (acessorioIds.length === 0) return new Map<string, { nome: string; livres: number }>();

  const [acessorios, comprometidos] = await Promise.all([
    db.acessorio.findMany({ where: { id: { in: acessorioIds } } }),
    db.solicitacaoAcessorio.groupBy({
      by: ['acessorioId'],
      where: {
        acessorioId: { in: acessorioIds },
        solicitacao: {
          status: { in: STATUS_OCUPANTES },
          dataInicio: { lt: fim },
          dataFim: { gt: inicio },
          ...(ignorarSolicitacaoId ? { id: { not: ignorarSolicitacaoId } } : {}),
        },
      },
      _sum: { quantidade: true },
    }),
  ]);

  const usados = new Map(comprometidos.map((c) => [c.acessorioId, c._sum.quantidade ?? 0]));
  return new Map(
    acessorios.map((a) => [a.id, { nome: a.nome, livres: a.quantidade - (usados.get(a.id) ?? 0) }])
  );
}

// Nomes dos acessórios do pedido que não têm unidades suficientes no período
export async function acessoriosEmFalta(
  db: Db,
  itens: ItemPedido[],
  inicio: Date,
  fim: Date,
  ignorarSolicitacaoId?: string
) {
  const livres = await unidadesLivres(
    db,
    itens.map((i) => i.acessorioId),
    inicio,
    fim,
    ignorarSolicitacaoId
  );
  return itens
    .filter((i) => (livres.get(i.acessorioId)?.livres ?? 0) < i.quantidade)
    .map((i) => livres.get(i.acessorioId)?.nome ?? 'Acessório removido');
}

// Trava as linhas dos acessórios até o fim da transação, para que duas
// aprovações simultâneas não usem a mesma unidade.
export async function travarAcessorios(tx: Prisma.TransactionClient, acessorioIds: string[]) {
  if (acessorioIds.length === 0) return;
  await tx.$queryRaw`SELECT id FROM "Acessorio" WHERE id IN (${Prisma.join(acessorioIds)}) FOR UPDATE`;
}

type ResultadoItens = { ok: true; itens: ItemPedido[] } | { ok: false; error: string };

// Monta os acessórios de um pedido: os obrigatórios do kit entram sempre e os
// opcionais pedidos precisam fazer parte do kit do recurso.
// pedidos: [{ id, quantidade? }] vindo do corpo da requisição
export async function montarItensDoPedido(recursoId: string, pedidos: unknown): Promise<ResultadoItens> {
  if (pedidos !== undefined && !Array.isArray(pedidos)) {
    return { ok: false, error: 'Envie os acessórios como lista: [{ id, quantidade }].' };
  }

  const kit = await prisma.recursoAcessorio.findMany({
    where: { recursoId, acessorio: { ativo: true } },
  });
  const noKit = new Map(kit.map((k) => [k.acessorioId, k]));
  const itens = new Map<string, number>(
    kit.filter((k) => k.obrigatorio).map((k) => [k.acessorioId, 1])
  );

  for (const pedido of (pedidos ?? []) as { id?: unknown; quantidade?: unknown }[]) {
    const id = String(pedido?.id ?? '');
    const quantidade = pedido?.quantidade ?? 1;
    if (!noKit.has(id)) {
      return { ok: false, error: 'Algum acessório pedido não acompanha este recurso.' };
    }
    if (!Number.isInteger(quantidade) || (quantidade as number) < 1) {
      return { ok: false, error: 'A quantidade de cada acessório deve ser um inteiro positivo.' };
    }
    itens.set(id, Math.max(itens.get(id) ?? 0, quantidade as number));
  }

  return {
    ok: true,
    itens: [...itens].map(([acessorioId, quantidade]) => ({ acessorioId, quantidade })),
  };
}
