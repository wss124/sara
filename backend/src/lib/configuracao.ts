import { prisma } from './prisma';
import { dataNoFuso, somarDias } from './fuso';

// Padrões usados enquanto o admin não salvar as regras (linha "padrao" da
// tabela Configuracao)
export const PADRAO_ANTECEDENCIA_MIN_HORAS = Number(process.env.ANTECEDENCIA_MIN_HORAS ?? 24);
export const PADRAO_ANTECEDENCIA_MAX_DIAS = Number(process.env.ANTECEDENCIA_MAX_DIAS ?? 30);

// Limites aceitos na edição: até 30 dias de antecedência mínima e até um ano
// de antecedência máxima
export const LIMITE_MIN_HORAS = 720;
export const LIMITE_MAX_DIAS = 365;

export interface RegrasAntecedencia {
  antecedenciaMinHoras: number;
  antecedenciaMaxDias: number;
}

export async function buscarConfiguracao(): Promise<RegrasAntecedencia> {
  const salva = await prisma.configuracao.findUnique({ where: { id: 'padrao' } });
  return {
    antecedenciaMinHoras: salva?.antecedenciaMinHoras ?? PADRAO_ANTECEDENCIA_MIN_HORAS,
    antecedenciaMaxDias: salva?.antecedenciaMaxDias ?? PADRAO_ANTECEDENCIA_MAX_DIAS,
  };
}

// Valida as regras completas (já mescladas com as atuais); devolve a
// mensagem de erro ou null
export function validarRegras(r: { antecedenciaMinHoras: unknown; antecedenciaMaxDias: unknown }) {
  const { antecedenciaMinHoras: min, antecedenciaMaxDias: max } = r;
  if (!Number.isInteger(min) || (min as number) < 0 || (min as number) > LIMITE_MIN_HORAS) {
    return `A antecedência mínima deve ser um número inteiro de 0 a ${LIMITE_MIN_HORAS} horas.`;
  }
  if (!Number.isInteger(max) || (max as number) < 1 || (max as number) > LIMITE_MAX_DIAS) {
    return `A antecedência máxima deve ser um número inteiro de 1 a ${LIMITE_MAX_DIAS} dias.`;
  }
  if ((min as number) >= (max as number) * 24) {
    return 'A antecedência mínima precisa ser menor que a máxima.';
  }
  return null;
}

// Último dia ("AAAA-MM-DD", fuso do campus) em que um pedido pode começar.
// O limite é por dia de calendário: com 30 dias, vale qualquer horário do
// 30º dia, independentemente da hora em que o pedido é feito.
export function ultimoDiaPermitido(maxDias: number, agora = new Date()) {
  return somarDias(dataNoFuso(agora), maxDias);
}

// Confere se o início respeita as regras. A máxima pode ser ignorada (séries
// semanais, que só têm a primeira data limitada). Devolve a mensagem ou null.
export function conferirAntecedencia(
  inicio: Date,
  regras: RegrasAntecedencia,
  { conferirMaxima = true, agora = new Date() } = {}
) {
  const { antecedenciaMinHoras: minHoras, antecedenciaMaxDias: maxDias } = regras;
  if (inicio.getTime() < agora.getTime() + minHoras * 3_600_000) {
    return `Os pedidos devem ser feitos com pelo menos ${minHoras} ${minHoras === 1 ? 'hora' : 'horas'} de antecedência.`;
  }
  if (conferirMaxima && dataNoFuso(inicio) > ultimoDiaPermitido(maxDias, agora)) {
    return `Os pedidos podem ser feitos com no máximo ${maxDias} ${maxDias === 1 ? 'dia' : 'dias'} de antecedência.`;
  }
  return null;
}
