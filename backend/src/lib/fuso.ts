// Fuso horário do campus (Piripiri-PI). O servidor pode rodar em outro fuso,
// então datas mostradas a pessoas são sempre formatadas neste.
export const FUSO = process.env.FUSO_HORARIO || 'America/Fortaleza';

const formatoData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const formatoHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: FUSO,
  hour: '2-digit',
  minute: '2-digit',
});

// Partes da data/hora no fuso do campus
function partesNoFuso(data: Date) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(data);
  const valor = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);
  return {
    ano: valor('year'),
    mes: valor('month'),
    dia: valor('day'),
    hora: valor('hour'),
    minuto: valor('minute'),
    segundo: valor('second'),
  };
}

// "2026-10-14" no fuso do campus
export function dataNoFuso(data: Date) {
  const { ano, mes, dia } = partesNoFuso(data);
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function horaNoFuso(data: Date) {
  return partesNoFuso(data).hora;
}

// Diferença em ms entre o relógio do campus e o UTC num instante
function deslocamentoDoFuso(data: Date) {
  const p = partesNoFuso(data);
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return comoUtc - Math.floor(data.getTime() / 1000) * 1000;
}

// Instante de um horário local do campus: dia "2026-10-14" às 13:30
export function instanteNoFuso(dia: string, hora = '00:00') {
  const [ano, mes, d] = dia.split('-').map(Number) as [number, number, number];
  const [h, m] = hora.split(':').map(Number) as [number, number];
  const comoUtc = Date.UTC(ano, mes - 1, d, h, m);
  // Primeira estimativa com o deslocamento daquele horário; a segunda passada
  // corrige o caso de o deslocamento mudar entre os dois (horário de verão)
  const estimativa = comoUtc - deslocamentoDoFuso(new Date(comoUtc));
  return new Date(comoUtc - deslocamentoDoFuso(new Date(estimativa)));
}

// Meia-noite do dia corrente no campus
export function inicioDoDiaNoFuso(data: Date) {
  return instanteNoFuso(dataNoFuso(data));
}

export function formatarData(data: Date) {
  return formatoData.format(data);
}

export function formatarHora(data: Date) {
  return formatoHora.format(data);
}

// Ex.: "ter., 14/10/2026, 13:30 – 18:00"
export function formatarPeriodo(inicio: Date, fim: Date) {
  const mesmoDia = formatarData(inicio) === formatarData(fim);
  return mesmoDia
    ? `${formatarData(inicio)}, ${formatarHora(inicio)} – ${formatarHora(fim)}`
    : `${formatarData(inicio)} ${formatarHora(inicio)} – ${formatarData(fim)} ${formatarHora(fim)}`;
}

// "2026-10-14" + 3 dias = "2026-10-17" (datas de calendário, sem fuso)
export function somarDias(dia: string, dias: number) {
  const [ano, mes, d] = dia.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(ano, mes - 1, d + dias)).toISOString().slice(0, 10);
}
