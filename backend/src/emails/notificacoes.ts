// Quem recebe cada e-mail do fluxo de reservas. Os envios acontecem em segundo
// plano: nenhuma rota espera pelo servidor de e-mail nem falha por causa dele.
import { prisma } from '../lib/prisma';
import { enviarEmSegundoPlano, type Email } from '../lib/email';
import * as templates from './templates';
import type { ReservaEmail } from './templates';

async function emailsDosAdmins() {
  const admins = await prisma.usuario.findMany({ where: { perfil: 'ADMIN' }, select: { email: true } });
  return admins.map((a) => a.email);
}

// No uso institucional o "usuário" é o próprio admin: não há professor a avisar
function paraProfessor(r: ReservaEmail, montar: () => Email) {
  if (!r.institucional) enviarEmSegundoPlano(montar());
}

function paraAdmins(montar: (admins: string[]) => Email) {
  emailsDosAdmins()
    .then((admins) => admins.length > 0 && enviarEmSegundoPlano(montar(admins)))
    .catch((error) => console.error('Erro ao buscar administradores para e-mail:', error));
}

export function pedidoCriado(r: ReservaEmail) {
  paraProfessor(r, () => templates.pedidoRecebido(r));
  paraAdmins((admins) => templates.novoPedidoParaAdmins(r, admins));
}

export function pedidoAprovado(r: ReservaEmail) {
  paraProfessor(r, () => templates.pedidoAprovado(r));
}

export function pedidoRecusado(r: ReservaEmail, motivo: string | null) {
  paraProfessor(r, () => templates.pedidoRecusado(r, motivo));
}

export function reservaLancada(r: ReservaEmail) {
  paraProfessor(r, () => templates.reservaLancada(r));
}

export function canceladaPeloAdmin(r: ReservaEmail, motivo: string | null) {
  paraProfessor(r, () => templates.reservaCanceladaParaProfessor(r, motivo));
}

export function canceladaPeloProfessor(r: ReservaEmail) {
  paraAdmins((admins) => templates.reservaCanceladaParaAdmins(r, admins));
}

export function devolucaoAtrasada(r: ReservaEmail, proxima: ReservaEmail | null) {
  paraProfessor(r, () => templates.devolucaoAtrasada(r));
  paraAdmins((admins) => templates.atrasoParaAdmins(r, admins, proxima));
}

export function lembreteRetirada(r: ReservaEmail) {
  paraProfessor(r, () => templates.lembreteRetirada(r));
}

export function lembreteDevolucao(r: ReservaEmail) {
  paraProfessor(r, () => templates.lembreteDevolucao(r));
}

export function resumoDiario(resumo: templates.ResumoDiario) {
  paraAdmins((admins) => templates.resumoDiarioParaAdmins(resumo, admins));
}

export function recursoForaDeUso(reservas: ReservaEmail[], estado: 'EM_MANUTENCAO' | 'INDISPONIVEL') {
  for (const r of reservas) paraProfessor(r, () => templates.recursoForaDeUso(r, estado));
}
