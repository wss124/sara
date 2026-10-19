import dayjs from 'dayjs';

// Período de um turno ("14:00"–"18:00") num dia escolhido no calendário
export function periodoDoTurno(dia, turno) {
  const em = (hora) => {
    const [h, m] = hora.split(':').map(Number);
    return dia.hour(h).minute(m).second(0).millisecond(0);
  };
  return [em(turno.horaInicio), em(turno.horaFim)];
}

export const SITUACOES_TURNO = {
  LIVRE: { label: 'Livre', color: 'green' },
  PARCIAL: { label: 'Parcialmente ocupado', color: 'gold' },
  OCUPADO: { label: 'Ocupado', color: 'red' },
  ENCERRADO: { label: 'Já começou', color: 'default' },
};

// Situação do turno no dia a partir das reservas (aprovadas ou em uso) do
// recurso: livre, parcialmente ocupado (com os trechos ocupados) ou ocupado
export function situacaoDoTurno(dia, turno, reservas) {
  const [inicio, fim] = periodoDoTurno(dia, turno);
  const conflitos = reservas.filter(
    (r) => dayjs(r.dataInicio).isBefore(fim) && dayjs(r.dataFim).isAfter(inicio)
  );

  if (inicio.isBefore(dayjs())) return { situacao: 'ENCERRADO', inicio, fim, conflitos };
  if (conflitos.length === 0) return { situacao: 'LIVRE', inicio, fim, conflitos };

  // Percorre as reservas em ordem: se nenhuma deixa um buraco, o turno está
  // todo tomado (mesmo que por várias reservas emendadas)
  let coberto = inicio;
  for (const r of [...conflitos].sort((a, b) => dayjs(a.dataInicio) - dayjs(b.dataInicio))) {
    if (dayjs(r.dataInicio).isAfter(coberto)) break;
    if (dayjs(r.dataFim).isAfter(coberto)) coberto = dayjs(r.dataFim);
  }
  const cobreTudo = !coberto.isBefore(fim);
  return { situacao: cobreTudo ? 'OCUPADO' : 'PARCIAL', inicio, fim, conflitos };
}
