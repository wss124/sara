import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { horaValida, emMinutos, turnosSeSobrepoem } from '../lib/turnos';

type ReqComId = Request<{ id: string }>;

// Turnos de aula do campus (manhã, tarde, noite), usados para reservar um
// turno inteiro de uma vez. Usuários comuns veem só os ativos.
export async function listar(req: Request, res: Response) {
  const isAdmin = req.usuario?.perfil === 'ADMIN';

  try {
    const turnos = await prisma.turno.findMany({
      where: isAdmin ? {} : { ativo: true },
      orderBy: [{ ordem: 'asc' }, { horaInicio: 'asc' }],
    });
    return res.json(turnos);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao listar turnos.' });
  }
}

interface DadosTurno {
  nome: string;
  horaInicio: string;
  horaFim: string;
  ordem: number;
  ativo: boolean;
}

// Valida os dados completos de um turno (já mesclados com o atual, na edição)
async function validar(dados: DadosTurno, ignorarId?: string) {
  if (!dados.nome?.trim()) return 'Informe o nome do turno.';
  if (!horaValida(dados.horaInicio) || !horaValida(dados.horaFim)) {
    return 'Informe os horários no formato HH:MM.';
  }
  if (emMinutos(dados.horaFim) <= emMinutos(dados.horaInicio)) {
    return 'O fim do turno deve ser depois do início.';
  }
  if (!Number.isInteger(dados.ordem)) return 'A ordem deve ser um número inteiro.';
  if (!dados.ativo) return null;

  const outros = await prisma.turno.findMany({
    where: { ativo: true, ...(ignorarId ? { id: { not: ignorarId } } : {}) },
  });
  const conflito = outros.find((t) => turnosSeSobrepoem(t, dados));
  return conflito ? `O horário se sobrepõe ao turno ${conflito.nome}.` : null;
}

export async function criar(req: Request, res: Response) {
  const { nome, horaInicio, horaFim, ordem = 0, ativo = true } = req.body;
  const dados = { nome, horaInicio, horaFim, ordem, ativo: Boolean(ativo) };

  try {
    const erro = await validar(dados);
    if (erro) return res.status(400).json({ error: erro });

    const turno = await prisma.turno.create({ data: { ...dados, nome: nome.trim() } });
    return res.status(201).json(turno);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao criar turno.' });
  }
}

export async function atualizar(req: ReqComId, res: Response) {
  const { id } = req.params;

  try {
    const atual = await prisma.turno.findUnique({ where: { id } });
    if (!atual) return res.status(404).json({ error: 'Turno não encontrado.' });

    const { nome, horaInicio, horaFim, ordem, ativo } = req.body;
    const dados: DadosTurno = {
      nome: nome ?? atual.nome,
      horaInicio: horaInicio ?? atual.horaInicio,
      horaFim: horaFim ?? atual.horaFim,
      ordem: ordem ?? atual.ordem,
      ativo: typeof ativo === 'boolean' ? ativo : atual.ativo,
    };

    const erro = await validar(dados, id);
    if (erro) return res.status(400).json({ error: erro });

    // Reservas já feitas guardam o período real; mudar o turno não as altera
    const turno = await prisma.turno.update({
      where: { id },
      data: { ...dados, nome: dados.nome.trim() },
    });
    return res.json(turno);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao atualizar turno.' });
  }
}

export async function remover(req: ReqComId, res: Response) {
  const { id } = req.params;

  try {
    const turno = await prisma.turno.findUnique({ where: { id } });
    if (!turno) return res.status(404).json({ error: 'Turno não encontrado.' });

    await prisma.turno.delete({ where: { id } });
    return res.status(204).send();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao remover turno.' });
  }
}
