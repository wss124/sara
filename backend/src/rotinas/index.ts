import { avisarAtrasos } from './atrasos';
import { lembrarRetiradas, lembrarDevolucoes, enviarResumoDiario } from './lembretes';

// Intervalo entre as verificações periódicas (atrasos e lembretes)
const INTERVALO_MS = Number(process.env.INTERVALO_ROTINAS_SEG ?? 60) * 1000;

const ROTINAS: [string, (agora: Date) => Promise<unknown>][] = [
  ['atrasos', avisarAtrasos],
  ['lembretes de retirada', lembrarRetiradas],
  ['lembretes de devolução', lembrarDevolucoes],
  ['resumo diário', enviarResumoDiario],
];

async function executarTodas() {
  const agora = new Date();
  for (const [nome, rotina] of ROTINAS) {
    try {
      await rotina(agora);
    } catch (error) {
      console.error(`Falha na rotina "${nome}":`, error);
    }
  }
}

// Chamado só pelo servidor (não pelos testes, que executam cada rotina direto)
export function iniciarRotinas() {
  let executando = false;
  const tick = async () => {
    if (executando) return;
    executando = true;
    await executarTodas();
    executando = false;
  };
  void tick();
  return setInterval(tick, INTERVALO_MS);
}
