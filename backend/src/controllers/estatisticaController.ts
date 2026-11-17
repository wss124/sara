import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { dataNoFuso, instanteNoFuso, somarDias } from '../lib/fuso';
import { diaValido } from '../lib/turnos';
import { MAX_DIAS_PERIODO, calcularEstatisticas, diasEntre } from '../lib/estatisticas';

// Estatísticas de uso dos recursos num período (padrão: últimos 30 dias)
export async function estatisticas(req: Request, res: Response) {
  const hoje = dataNoFuso(new Date());
  const inicio = typeof req.query.inicio === 'string' ? req.query.inicio : somarDias(hoje, -29);
  const fim = typeof req.query.fim === 'string' ? req.query.fim : hoje;

  if (!diaValido(inicio) || !diaValido(fim)) {
    return res.status(400).json({ error: 'Informe as datas no formato AAAA-MM-DD.' });
  }
  if (inicio > fim) {
    return res.status(400).json({ error: 'A data inicial deve ser anterior à final.' });
  }
  if (diasEntre(inicio, fim).length > MAX_DIAS_PERIODO) {
    return res.status(400).json({ error: 'Consulte no máximo um ano por vez.' });
  }

  try {
    const comeco = instanteNoFuso(inicio);
    const termino = instanteNoFuso(somarDias(fim, 1));

    const [recursos, turnos, reservas] = await Promise.all([
      prisma.recurso.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, tipo: true },
        orderBy: { nome: 'asc' },
      }),
      prisma.turno.findMany({
        where: { ativo: true },
        select: { id: true, nome: true, horaInicio: true, horaFim: true },
        orderBy: [{ ordem: 'asc' }, { horaInicio: 'asc' }],
      }),
      prisma.solicitacao.findMany({
        where: { dataInicio: { lt: termino }, dataFim: { gt: comeco } },
        select: {
          recursoId: true,
          status: true,
          institucional: true,
          dataInicio: true,
          dataFim: true,
          devolvidoEm: true,
          condicaoDevolucao: true,
        },
      }),
    ]);

    return res.json(calcularEstatisticas({ inicio, fim, recursos, turnos, reservas }));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao calcular as estatísticas.' });
  }
}
