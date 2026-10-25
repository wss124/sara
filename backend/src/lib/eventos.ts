import type { Response } from 'express';

// Dashboards abertos recebem, por Server-Sent Events, um aviso sempre que
// algo muda (pedido criado, aprovado, retirada registrada...). O aviso não
// leva dados: cada tela busca o próprio resumo de novo, já filtrado pelo
// perfil de quem está vendo.
const conexoes = new Set<Response>();

// Ações em lote (aprovar uma série inteira) viram um aviso só
const AGRUPAR_MS = Number(process.env.EVENTOS_AGRUPAR_MS ?? 250);
// Comentário periódico para proxies não derrubarem a conexão parada
const BATIMENTO_MS = 25_000;

let avisoAgendado: NodeJS.Timeout | null = null;

const batimento = setInterval(() => {
  for (const res of conexoes) res.write(': ping\n\n');
}, BATIMENTO_MS);
batimento.unref();

export function inscrever(res: Response) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  // Se a conexão cair, o navegador tenta de novo depois de 5 s
  res.write('retry: 5000\n\n');
  conexoes.add(res);
  res.on('close', () => conexoes.delete(res));
}

export function totalDeConexoes() {
  return conexoes.size;
}

export function avisarMudanca() {
  if (avisoAgendado) return;
  avisoAgendado = setTimeout(() => {
    avisoAgendado = null;
    const mensagem = `event: atualizacao\ndata: ${JSON.stringify({ em: new Date().toISOString() })}\n\n`;
    for (const res of conexoes) res.write(mensagem);
  }, AGRUPAR_MS);
}
