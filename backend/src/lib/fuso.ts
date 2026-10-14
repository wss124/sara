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
