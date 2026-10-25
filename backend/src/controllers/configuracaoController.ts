import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { buscarConfiguracao, validarRegras, ultimoDiaPermitido } from '../lib/configuracao';

// Regras de antecedência dos pedidos. Todos leem (a tela de pedido usa para
// limitar o calendário); só o admin altera.
export async function obter(req: Request, res: Response) {
  try {
    const regras = await buscarConfiguracao();
    return res.json({ ...regras, ultimoDiaPermitido: ultimoDiaPermitido(regras.antecedenciaMaxDias) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao carregar as regras.' });
  }
}

export async function atualizar(req: Request, res: Response) {
  try {
    const atuais = await buscarConfiguracao();
    const regras = {
      antecedenciaMinHoras: req.body.antecedenciaMinHoras ?? atuais.antecedenciaMinHoras,
      antecedenciaMaxDias: req.body.antecedenciaMaxDias ?? atuais.antecedenciaMaxDias,
    };

    const erro = validarRegras(regras);
    if (erro) return res.status(400).json({ error: erro });

    // Pedidos já feitos não são revistos; as regras valem para os próximos
    const salvas = await prisma.configuracao.upsert({
      where: { id: 'padrao' },
      create: { id: 'padrao', ...regras },
      update: regras,
    });
    return res.json({
      antecedenciaMinHoras: salvas.antecedenciaMinHoras,
      antecedenciaMaxDias: salvas.antecedenciaMaxDias,
      ultimoDiaPermitido: ultimoDiaPermitido(salvas.antecedenciaMaxDias),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao salvar as regras.' });
  }
}
