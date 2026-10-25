import nodemailer, { type Transporter } from 'nodemailer';

export interface Email {
  para: string | string[];
  assunto: string;
  html: string;
  texto: string;
}

let transporte: Transporter | null = null;

// Criado na primeira mensagem, depois que o .env já foi carregado.
// Sem SMTP_HOST, as mensagens não saem do servidor: são só registradas no log.
function obterTransporte() {
  if (transporte) return transporte;

  const host = process.env.SMTP_HOST;
  if (!host) {
    transporte = nodemailer.createTransport({ jsonTransport: true });
    return transporte;
  }

  const porta = Number(process.env.SMTP_PORT ?? 587);
  transporte = nodemailer.createTransport({
    host,
    port: porta,
    secure: porta === 465,
    ...(process.env.SMTP_USER
      ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? '' } }
      : {}),
  });
  return transporte;
}

// Envia e devolve se deu certo. Uma falha no e-mail nunca derruba a operação
// que o disparou (aprovação, devolução...): o erro só vai para o log.
export async function enviarEmail(email: Email) {
  const destinatarios = [email.para].flat().filter(Boolean);
  if (destinatarios.length === 0) return false;

  try {
    const info = await obterTransporte().sendMail({
      from: process.env.EMAIL_REMETENTE || 'SARA <nao-responda@sara.local>',
      to: destinatarios,
      subject: email.assunto,
      html: email.html,
      text: email.texto,
    });
    if (!process.env.SMTP_HOST) {
      console.log(`[e-mail não enviado: SMTP_HOST vazio] ${email.assunto} -> ${destinatarios.join(', ')}`);
    }
    return Boolean(info.messageId);
  } catch (error) {
    console.error(`Falha ao enviar e-mail "${email.assunto}":`, error);
    return false;
  }
}

// Dispara sem esperar: a resposta HTTP não fica presa ao servidor de e-mail
export function enviarEmSegundoPlano(email: Email) {
  void enviarEmail(email);
}
