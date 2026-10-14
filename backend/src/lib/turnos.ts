import { instanteNoFuso } from './fuso';

const FORMATO_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

export function horaValida(valor: unknown): valor is string {
  return typeof valor === 'string' && FORMATO_HORA.test(valor);
}

export function diaValido(valor: unknown): valor is string {
  return typeof valor === 'string' && FORMATO_DIA.test(valor) && !Number.isNaN(Date.parse(valor));
}

// "13:30" -> 810 (minutos desde a meia-noite)
export function emMinutos(hora: string) {
  const [h, m] = hora.split(':').map(Number) as [number, number];
  return h * 60 + m;
}

interface FaixaHoraria {
  horaInicio: string;
  horaFim: string;
}

// Dois turnos se sobrepõem se um começa antes de o outro terminar
export function turnosSeSobrepoem(a: FaixaHoraria, b: FaixaHoraria) {
  return emMinutos(a.horaInicio) < emMinutos(b.horaFim) && emMinutos(b.horaInicio) < emMinutos(a.horaFim);
}

// Período real de um turno num dia, no fuso do campus.
// Ex.: tarde de 14/10/2026 -> 14/10 13:30 até 14/10 18:00 (America/Fortaleza)
export function periodoDoTurno(dia: string, turno: FaixaHoraria) {
  return { inicio: instanteNoFuso(dia, turno.horaInicio), fim: instanteNoFuso(dia, turno.horaFim) };
}
