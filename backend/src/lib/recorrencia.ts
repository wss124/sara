import { diaValido, horaValida, emMinutos } from './turnos';
import { somarDias } from './fuso';

// Uma série vai no máximo até ~6 meses (um semestre) a partir do primeiro dia
export const RECORRENCIA_MAX_DIAS = Number(process.env.RECORRENCIA_MAX_DIAS ?? 183);
export const RECORRENCIA_MAX_OCORRENCIAS = 100;

export const NOMES_DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// Dia da semana de uma data de calendário (0 = domingo)
export function diaDaSemana(dia: string) {
  const [ano, mes, d] = dia.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(ano, mes - 1, d)).getUTCDay();
}

function diasEntre(de: string, ate: string) {
  return Math.round((Date.parse(ate) - Date.parse(de)) / 86_400_000);
}

// Datas da série: cada dia entre o início e o fim (inclusivos) que cai num
// dos dias da semana escolhidos
export function gerarDatas(dataInicio: string, dataFim: string, diasSemana: number[]) {
  const datas: string[] = [];
  const total = diasEntre(dataInicio, dataFim);
  for (let i = 0; i <= total; i++) {
    const dia = somarDias(dataInicio, i);
    if (diasSemana.includes(diaDaSemana(dia))) datas.push(dia);
  }
  return datas;
}

export interface ParametrosSerie {
  diasSemana: number[];
  dataInicio: string;
  dataFim: string;
  horaInicio: string;
  horaFim: string;
}

// Valida os parâmetros da série; devolve a mensagem de erro ou null
export function validarSerie(p: {
  diasSemana: unknown;
  dataInicio: unknown;
  dataFim: unknown;
  horaInicio: unknown;
  horaFim: unknown;
}): string | null {
  if (
    !Array.isArray(p.diasSemana) ||
    p.diasSemana.length === 0 ||
    p.diasSemana.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
  ) {
    return 'Escolha os dias da semana da repetição.';
  }
  if (!diaValido(p.dataInicio) || !diaValido(p.dataFim)) {
    return 'Informe o primeiro e o último dia no formato AAAA-MM-DD.';
  }
  if (p.dataFim < p.dataInicio) return 'O último dia deve ser depois do primeiro.';
  if (diasEntre(p.dataInicio, p.dataFim) > RECORRENCIA_MAX_DIAS) {
    return `A repetição pode durar no máximo ${RECORRENCIA_MAX_DIAS} dias.`;
  }
  if (!horaValida(p.horaInicio) || !horaValida(p.horaFim)) {
    return 'Informe o horário no formato HH:MM.';
  }
  if (emMinutos(p.horaFim) <= emMinutos(p.horaInicio)) {
    return 'O horário de fim deve ser depois do início.';
  }
  const datas = gerarDatas(p.dataInicio, p.dataFim, p.diasSemana);
  if (datas.length === 0) return 'Nenhuma data do período cai nos dias da semana escolhidos.';
  if (datas.length > RECORRENCIA_MAX_OCORRENCIAS) {
    return `A repetição pode ter no máximo ${RECORRENCIA_MAX_OCORRENCIAS} datas.`;
  }
  return null;
}

// Ex.: "toda terça", "todo sábado", "toda semana (terça e quinta)"
export function descreverDias(diasSemana: number[]) {
  const ordenados = [...diasSemana].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const nomes = ordenados.map((d) => NOMES_DIAS[d]!);
  if (nomes.length === 1) {
    const fimDeSemana = ordenados[0] === 0 || ordenados[0] === 6;
    return `${fimDeSemana ? 'todo' : 'toda'} ${nomes[0]}`;
  }
  return `toda semana (${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]})`;
}
