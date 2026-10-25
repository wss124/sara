import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { STATUS_OCUPANTES } from '../lib/status';
import { dataNoFuso, instanteNoFuso, somarDias } from '../lib/fuso';
import { diaValido, periodoDoTurno, situacaoDoPeriodo } from '../lib/turnos';

type ReqComId = Request<{ id: string }>;

const MAXIMO_DIAS = 14;

// Disponibilidade de um recurso por turno, dia a dia: a grade do pedido usa um
// dia; a visão semanal, sete. Para cada turno: situação, trechos ocupados
// (reservas aprovadas ou em uso) e quantos pedidos aguardam análise.
export async function disponibilidade(req: ReqComId, res: Response) {
  const { id } = req.params;
  const inicio = req.query.inicio ?? dataNoFuso(new Date());
  const dias = Number(req.query.dias ?? 1);

  if (!diaValido(inicio)) {
    return res.status(400).json({ error: 'Informe o início no formato AAAA-MM-DD.' });
  }
  if (!Number.isInteger(dias) || dias < 1 || dias > MAXIMO_DIAS) {
    return res.status(400).json({ error: `Informe de 1 a ${MAXIMO_DIAS} dias.` });
  }

  try {
    const recurso = await prisma.recurso.findUnique({
      where: { id },
      select: { id: true, nome: true, estado: true, ativo: true },
    });
    if (!recurso || (!recurso.ativo && req.usuario?.perfil !== 'ADMIN')) {
      return res.status(404).json({ error: 'Recurso não encontrado.' });
    }

    const de = instanteNoFuso(inicio);
    const ate = instanteNoFuso(somarDias(inicio, dias));
    const [turnos, reservas] = await Promise.all([
      prisma.turno.findMany({ where: { ativo: true }, orderBy: { horaInicio: 'asc' } }),
      prisma.solicitacao.findMany({
        where: {
          recursoId: id,
          status: { in: [...STATUS_OCUPANTES, 'PENDENTE'] },
          dataInicio: { lt: ate },
          dataFim: { gt: de },
        },
        select: { status: true, dataInicio: true, dataFim: true },
      }),
    ]);
    const ocupantes = reservas.filter((r) => r.status !== 'PENDENTE');
    const pendentes = reservas.filter((r) => r.status === 'PENDENTE');
    const agora = new Date();

    const lista = Array.from({ length: dias }, (_, i) => {
      const dia = somarDias(inicio, i);
      return {
        data: dia,
        turnos: turnos.map((turno) => {
          const { inicio: ini, fim } = periodoDoTurno(dia, turno);
          const sobrepoe = (r: { dataInicio: Date; dataFim: Date }) => r.dataInicio < fim && r.dataFim > ini;
          return {
            turnoId: turno.id,
            situacao: situacaoDoPeriodo(ini, fim, ocupantes, agora),
            ocupados: ocupantes
              .filter(sobrepoe)
              .map((r) => ({ inicio: r.dataInicio, fim: r.dataFim }))
              .sort((a, b) => a.inicio.getTime() - b.inicio.getTime()),
            pendentes: pendentes.filter(sobrepoe).length,
          };
        }),
      };
    });

    return res.json({
      recurso: { id: recurso.id, nome: recurso.nome, estado: recurso.estado },
      turnos: turnos.map(({ id, nome, horaInicio, horaFim }) => ({ id, nome, horaInicio, horaFim })),
      dias: lista,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao consultar a disponibilidade.' });
  }
}
