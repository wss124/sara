import type { Email } from '../lib/email';
import { formatarHora, formatarPeriodo } from '../lib/fuso';
import { descreverDias } from '../lib/recorrencia';

// Dados de uma reserva usados nos e-mails (mesmo formato de incluirDetalhes)
export interface ReservaEmail {
  dataInicio: Date;
  dataFim: Date;
  observacao: string | null;
  institucional: boolean;
  usuario: { nome: string; email: string };
  recurso: { nome: string; localizacao: string | null };
  acessorios?: { quantidade: number; acessorio: { nome: string; localizacao: string | null } }[];
  turno?: { nome: string } | null;
}

const AZUL = '#0b2149';

function escapar(texto: string) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function urlDoSistema(caminho = '') {
  return `${process.env.APP_URL || 'http://localhost:5173'}${caminho}`;
}

function primeiroNome(nome: string) {
  return nome.split(' ')[0];
}

// Linhas "rótulo: valor" do resumo da reserva, em texto puro
function linhasDaReserva(r: ReservaEmail, comRetirada = false) {
  const linhas: [string, string][] = [
    ['Recurso', r.recurso.nome],
    ['Quando', `${r.turno ? `${r.turno.nome} · ` : ''}${formatarPeriodo(r.dataInicio, r.dataFim)}`],
  ];
  if (comRetirada && r.recurso.localizacao) linhas.push(['Retirar em', r.recurso.localizacao]);
  if (r.acessorios?.length) {
    linhas.push([
      'Acompanha',
      r.acessorios
        .map((a) => {
          const nome = a.quantidade > 1 ? `${a.acessorio.nome} (${a.quantidade})` : a.acessorio.nome;
          return comRetirada && a.acessorio.localizacao ? `${nome}, em ${a.acessorio.localizacao}` : nome;
        })
        .join('; '),
    ]);
  }
  if (r.observacao) linhas.push([r.institucional ? 'Finalidade' : 'Observação', r.observacao]);
  return linhas;
}

// Dados de uma série semanal usados nos e-mails
export interface SerieEmail {
  horaInicio: string;
  horaFim: string;
  diasSemana: number[];
  dataInicio: string;
  dataFim: string;
  observacao: string | null;
  usuario: { nome: string; email: string };
  recurso: { nome: string; localizacao: string | null };
  turno?: { nome: string } | null;
}

// "2026-10-20" -> "20/10/2026"
function dataCurta(dia: string) {
  const [ano, mes, d] = dia.split('-');
  return `${d}/${mes}/${ano}`;
}

function linhasDaSerie(s: SerieEmail, comRetirada = false) {
  const horario = `${s.horaInicio}–${s.horaFim}`;
  const linhas: [string, string][] = [
    ['Recurso', s.recurso.nome],
    ['Quando', `${descreverDias(s.diasSemana)}, ${s.turno ? `${s.turno.nome} (${horario})` : horario}`],
    ['Período', `${dataCurta(s.dataInicio)} a ${dataCurta(s.dataFim)}`],
  ];
  if (comRetirada && s.recurso.localizacao) linhas.push(['Retirar em', s.recurso.localizacao]);
  if (s.observacao) linhas.push(['Observação', s.observacao]);
  return linhas;
}

interface Conteudo {
  para: string | string[];
  assunto: string;
  titulo: string;
  paragrafos: string[];
  reserva?: ReservaEmail;
  // Linhas do resumo quando o e-mail não é sobre uma reserva só
  linhas?: [string, string][];
  comRetirada?: boolean;
  destaque?: string;
  link?: { texto: string; caminho: string };
}

// Monta o e-mail nas versões HTML (layout simples, compatível com clientes de
// e-mail) e texto puro, a partir do mesmo conteúdo
function montar(c: Conteudo): Email {
  const linhas = c.linhas ?? (c.reserva ? linhasDaReserva(c.reserva, c.comRetirada) : []);
  const link = c.link ? urlDoSistema(c.link.caminho) : urlDoSistema();

  const tabela = linhas.length
    ? `<table cellpadding="6" style="border-collapse:collapse;margin:16px 0;font-size:14px">${linhas
        .map(
          ([rotulo, valor]) =>
            `<tr><td style="color:#666;vertical-align:top;white-space:nowrap">${escapar(rotulo)}</td><td style="color:#111"><strong>${escapar(valor)}</strong></td></tr>`
        )
        .join('')}</table>`
    : '';

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f2f4f8;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
<tr><td style="background:${AZUL};padding:18px 24px;color:#fff;font-size:20px;font-weight:bold;letter-spacing:2px">SARA</td></tr>
<tr><td style="padding:24px;color:#222;font-size:15px;line-height:1.5">
<h1 style="margin:0 0 12px;font-size:20px;color:${AZUL}">${escapar(c.titulo)}</h1>
${c.paragrafos.map((p) => `<p style="margin:0 0 10px">${escapar(p)}</p>`).join('')}
${c.destaque ? `<p style="margin:12px 0;padding:10px 14px;border-radius:8px;background:#f5f7fb">${escapar(c.destaque)}</p>` : ''}
${tabela}
<p style="margin:20px 0 0"><a href="${escapar(link)}" style="display:inline-block;padding:10px 18px;border-radius:999px;background:${AZUL};color:#fff;text-decoration:none;font-weight:bold">${escapar(c.link?.texto ?? 'Abrir o SARA')}</a></p>
</td></tr>
<tr><td style="padding:14px 24px;color:#999;font-size:12px">Sistema de Alocação de Recursos Acadêmicos · UESPI Piripiri. Mensagem automática, não responda.</td></tr>
</table></body></html>`;

  const texto = [
    c.titulo,
    '',
    ...c.paragrafos,
    ...(c.destaque ? ['', c.destaque] : []),
    ...(linhas.length ? ['', ...linhas.map(([r, v]) => `${r}: ${v}`)] : []),
    '',
    `${c.link?.texto ?? 'Abrir o SARA'}: ${link}`,
  ].join('\n');

  return { para: c.para, assunto: c.assunto, html, texto };
}

export function pedidoRecebido(r: ReservaEmail): Email {
  return montar({
    para: r.usuario.email,
    assunto: `Pedido recebido: ${r.recurso.nome}`,
    titulo: 'Recebemos seu pedido',
    paragrafos: [
      `Olá, ${primeiroNome(r.usuario.nome)}! Seu pedido foi registrado e aguarda a análise do administrador.`,
      'Você receberá outro e-mail quando ele for aprovado ou recusado.',
    ],
    reserva: r,
    link: { texto: 'Ver minhas solicitações', caminho: '/requests' },
  });
}

export function novoPedidoParaAdmins(r: ReservaEmail, admins: string[]): Email {
  return montar({
    para: admins,
    assunto: `Novo pedido para aprovar: ${r.recurso.nome}`,
    titulo: 'Novo pedido aguardando aprovação',
    paragrafos: [`${r.usuario.nome} solicitou um recurso.`],
    reserva: r,
    link: { texto: 'Abrir Aprovações', caminho: '/approvals' },
  });
}

export function pedidoAprovado(r: ReservaEmail): Email {
  return montar({
    para: r.usuario.email,
    assunto: `Reserva aprovada: ${r.recurso.nome}`,
    titulo: 'Sua reserva foi aprovada',
    paragrafos: [
      `Olá, ${primeiroNome(r.usuario.nome)}! O recurso está reservado para você.`,
      'Retire no local indicado e devolva ao fim do uso.',
    ],
    reserva: r,
    comRetirada: true,
    link: { texto: 'Ver minhas solicitações', caminho: '/requests' },
  });
}

export function pedidoRecusado(r: ReservaEmail, motivo: string | null): Email {
  return montar({
    para: r.usuario.email,
    assunto: `Pedido recusado: ${r.recurso.nome}`,
    titulo: 'Seu pedido foi recusado',
    paragrafos: [`Olá, ${primeiroNome(r.usuario.nome)}. Infelizmente seu pedido não pôde ser atendido.`],
    ...(motivo ? { destaque: `Motivo: ${motivo}` } : {}),
    reserva: r,
    link: { texto: 'Fazer outro pedido', caminho: '/requests' },
  });
}

export function reservaLancada(r: ReservaEmail): Email {
  return montar({
    para: r.usuario.email,
    assunto: `Reserva registrada para você: ${r.recurso.nome}`,
    titulo: 'Uma reserva foi registrada para você',
    paragrafos: [
      `Olá, ${primeiroNome(r.usuario.nome)}! O administrador registrou esta reserva em seu nome, já aprovada.`,
    ],
    reserva: r,
    comRetirada: true,
    link: { texto: 'Ver minhas solicitações', caminho: '/requests' },
  });
}

export function reservaCanceladaParaProfessor(r: ReservaEmail, motivo: string | null): Email {
  return montar({
    para: r.usuario.email,
    assunto: `Reserva cancelada: ${r.recurso.nome}`,
    titulo: 'Sua reserva foi cancelada',
    paragrafos: [`Olá, ${primeiroNome(r.usuario.nome)}. O administrador cancelou esta reserva.`],
    ...(motivo ? { destaque: `Motivo: ${motivo}` } : {}),
    reserva: r,
    link: { texto: 'Fazer outro pedido', caminho: '/requests' },
  });
}

export function reservaCanceladaParaAdmins(r: ReservaEmail, admins: string[]): Email {
  return montar({
    para: admins,
    assunto: `Reserva cancelada pelo professor: ${r.recurso.nome}`,
    titulo: 'Uma reserva aprovada foi cancelada',
    paragrafos: [`${r.usuario.nome} cancelou a reserva abaixo. O horário voltou a ficar livre.`],
    reserva: r,
    link: { texto: 'Abrir Aprovações', caminho: '/approvals' },
  });
}

export function recursoForaDeUso(r: ReservaEmail, estado: 'EM_MANUTENCAO' | 'INDISPONIVEL'): Email {
  const situacao = estado === 'EM_MANUTENCAO' ? 'entrou em manutenção' : 'ficou indisponível';
  return montar({
    para: r.usuario.email,
    assunto: `Atenção: ${r.recurso.nome} ${situacao}`,
    titulo: `Um recurso que você reservou ${situacao}`,
    paragrafos: [
      `Olá, ${primeiroNome(r.usuario.nome)}. O recurso da reserva abaixo ${situacao}.`,
      'Sua reserva continua registrada por enquanto. Se ele não voltar a tempo, o administrador vai cancelá-la e avisar você. Se preferir, faça um pedido de outro recurso.',
    ],
    reserva: r,
    link: { texto: 'Ver minhas solicitações', caminho: '/requests' },
  });
}

export function lembreteRetirada(r: ReservaEmail): Email {
  return montar({
    para: r.usuario.email,
    assunto: `Lembrete: ${r.recurso.nome} às ${formatarHora(r.dataInicio)}`,
    titulo: 'Sua reserva começa em breve',
    paragrafos: [`Olá, ${primeiroNome(r.usuario.nome)}! Não esqueça de retirar o recurso.`],
    reserva: r,
    comRetirada: true,
    link: { texto: 'Ver minhas solicitações', caminho: '/requests' },
  });
}

export function lembreteDevolucao(r: ReservaEmail): Email {
  return montar({
    para: r.usuario.email,
    assunto: `Lembrete: devolver ${r.recurso.nome} até ${formatarHora(r.dataFim)}`,
    titulo: 'Sua reserva está terminando',
    paragrafos: [
      `Olá, ${primeiroNome(r.usuario.nome)}! A reserva termina às ${formatarHora(r.dataFim)}. Devolva o recurso e os acessórios no local de retirada.`,
    ],
    reserva: r,
    comRetirada: true,
  });
}

export function devolucaoAtrasada(r: ReservaEmail): Email {
  return montar({
    para: r.usuario.email,
    assunto: `Devolução atrasada: ${r.recurso.nome}`,
    titulo: 'A devolução está atrasada',
    paragrafos: [
      `Olá, ${primeiroNome(r.usuario.nome)}. A reserva terminou às ${formatarHora(r.dataFim)} e o recurso ainda não foi devolvido.`,
      'Outros professores podem estar esperando por ele. Devolva o quanto antes no local de retirada.',
    ],
    reserva: r,
    comRetirada: true,
  });
}

export function atrasoParaAdmins(r: ReservaEmail, admins: string[], proxima: ReservaEmail | null): Email {
  return montar({
    para: admins,
    assunto: `Devolução atrasada: ${r.recurso.nome}`,
    titulo: 'Recurso não devolvido no horário',
    paragrafos: [
      `${r.usuario.nome} ainda não devolveu o recurso, cuja reserva terminou às ${formatarHora(r.dataFim)}.`,
    ],
    ...(proxima
      ? {
          destaque: `Próxima reserva: ${proxima.usuario.nome}, ${formatarPeriodo(proxima.dataInicio, proxima.dataFim)}.`,
        }
      : {}),
    reserva: r,
    link: { texto: 'Abrir Retiradas e devoluções', caminho: '/handovers' },
  });
}

export interface ResumoDiario {
  retiradas: ReservaEmail[];
  emUso: ReservaEmail[];
  pendentes: number;
}

export function resumoDiarioParaAdmins(resumo: ResumoDiario, admins: string[]): Email {
  const linha = (r: ReservaEmail) =>
    `${formatarHora(r.dataInicio)}–${formatarHora(r.dataFim)} · ${r.recurso.nome} · ${r.institucional ? 'Uso institucional' : r.usuario.nome}`;

  return montar({
    para: admins,
    assunto: 'Resumo do dia no SARA',
    titulo: 'Resumo do dia',
    paragrafos: [
      `Retiradas previstas para hoje: ${resumo.retiradas.length}.`,
      ...resumo.retiradas.map(linha),
      `Recursos ainda fora (em uso): ${resumo.emUso.length}.`,
      ...resumo.emUso.map(linha),
      `Pedidos aguardando aprovação: ${resumo.pendentes}.`,
    ],
    link: { texto: 'Abrir Retiradas e devoluções', caminho: '/handovers' },
  });
}

// ---------- Séries semanais ----------

export interface DataRecusada {
  data: string;
  motivo: string;
}

function listaDeDatas(titulo: string, datas: DataRecusada[]) {
  return datas.length ? [titulo, ...datas.map((d) => `${dataCurta(d.data)}: ${d.motivo}`)] : [];
}

export function serieRecebida(s: SerieEmail, quantidade: number, puladas: DataRecusada[]): Email {
  return montar({
    para: s.usuario.email,
    assunto: `Pedido de série recebido: ${s.recurso.nome}`,
    titulo: 'Recebemos seu pedido semanal',
    paragrafos: [
      `Olá, ${primeiroNome(s.usuario.nome)}! ${quantidade} data(s) foram registradas e aguardam a análise do administrador.`,
      ...listaDeDatas('Datas que ficaram de fora:', puladas),
    ],
    linhas: linhasDaSerie(s),
    link: { texto: 'Ver minhas solicitações', caminho: '/requests' },
  });
}

export function novaSerieParaAdmins(s: SerieEmail, quantidade: number, admins: string[]): Email {
  return montar({
    para: admins,
    assunto: `Nova série para aprovar: ${s.recurso.nome}`,
    titulo: 'Novo pedido semanal aguardando aprovação',
    paragrafos: [`${s.usuario.nome} solicitou o recurso em ${quantidade} data(s).`],
    linhas: linhasDaSerie(s),
    link: { texto: 'Abrir Aprovações', caminho: '/approvals' },
  });
}

export function serieAprovada(s: SerieEmail, aprovadas: number, falhas: DataRecusada[]): Email {
  return montar({
    para: s.usuario.email,
    assunto: `Série aprovada: ${s.recurso.nome}`,
    titulo: falhas.length ? 'Sua série foi aprovada em parte' : 'Sua série foi aprovada',
    paragrafos: [
      `Olá, ${primeiroNome(s.usuario.nome)}! ${aprovadas} data(s) estão reservadas para você. Retire no local indicado e devolva ao fim de cada uso.`,
      ...listaDeDatas('Datas que não puderam ser aprovadas:', falhas),
    ],
    linhas: linhasDaSerie(s, true),
    link: { texto: 'Ver minhas solicitações', caminho: '/requests' },
  });
}

export function serieRecusada(s: SerieEmail, quantidade: number, motivo: string | null): Email {
  return montar({
    para: s.usuario.email,
    assunto: `Série recusada: ${s.recurso.nome}`,
    titulo: 'Seu pedido semanal foi recusado',
    paragrafos: [
      `Olá, ${primeiroNome(s.usuario.nome)}. ${quantidade} data(s) pendentes do pedido abaixo não puderam ser atendidas.`,
    ],
    ...(motivo ? { destaque: `Motivo: ${motivo}` } : {}),
    linhas: linhasDaSerie(s),
    link: { texto: 'Fazer outro pedido', caminho: '/requests' },
  });
}

export function serieCanceladaParaAdmins(s: SerieEmail, canceladas: number, admins: string[]): Email {
  return montar({
    para: admins,
    assunto: `Série cancelada pelo professor: ${s.recurso.nome}`,
    titulo: 'Uma série de reservas foi cancelada',
    paragrafos: [
      `${s.usuario.nome} cancelou a série abaixo. ${canceladas} reserva(s) aprovada(s) voltaram a ficar livres.`,
    ],
    linhas: linhasDaSerie(s),
    link: { texto: 'Abrir Aprovações', caminho: '/approvals' },
  });
}
