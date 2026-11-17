import { dataNoFuso, instanteNoFuso, somarDias } from './fuso';
import { periodoDoTurno } from './turnos';
import { TOLERANCIA_ATRASO_MIN } from './status';

// Cálculo das estatísticas de uso a partir dos dados já carregados do banco.
//
// Ocupação: cada combinação recurso x turno x dia útil (segunda a sexta) é um
// "período" possível. Ele conta como ocupado se alguma reserva aprovada, em
// andamento ou concluída se sobrepõe a ele, mesmo que só em parte. A taxa é
// a fração de períodos ocupados, que é como o campus enxerga o uso: "a sala
// foi usada na terça à tarde", e não "a sala foi usada 2h37".

export const MAX_DIAS_PERIODO = 366;

const NOMES_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIAS_UTEIS = [1, 2, 3, 4, 5];

interface RecursoBase {
  id: string;
  nome: string;
  tipo: string;
}

interface TurnoBase {
  id: string;
  nome: string;
  horaInicio: string;
  horaFim: string;
}

export interface ReservaBase {
  recursoId: string;
  status: string;
  institucional: boolean;
  dataInicio: Date;
  dataFim: Date;
  devolvidoEm: Date | null;
  condicaoDevolucao: string | null;
}

interface Entrada {
  inicio: string; // "AAAA-MM-DD", inclusivo
  fim: string; // "AAAA-MM-DD", inclusivo
  recursos: RecursoBase[];
  turnos: TurnoBase[];
  reservas: ReservaBase[];
  agora?: Date;
}

const STATUS_QUE_OCUPAM = ['APROVADA', 'EM_ANDAMENTO', 'CONCLUIDA'];

function diaDaSemana(dia: string) {
  return new Date(`${dia}T00:00:00Z`).getUTCDay();
}

// Segunda-feira da semana do dia ("2026-10-08" -> "2026-10-05")
function segundaDaSemana(dia: string) {
  return somarDias(dia, -((diaDaSemana(dia) + 6) % 7));
}

function porcentagem(parte: number, total: number) {
  return total ? Math.round((parte / total) * 100) : 0;
}

export function diasEntre(inicio: string, fim: string) {
  const dias: string[] = [];
  for (let dia = inicio; dia <= fim; dia = somarDias(dia, 1)) dias.push(dia);
  return dias;
}

export function calcularEstatisticas({ inicio, fim, recursos, turnos, reservas, agora = new Date() }: Entrada) {
  const dias = diasEntre(inicio, fim);
  const diasUteis = dias.filter((d) => DIAS_UTEIS.includes(diaDaSemana(d)));
  const comecoPeriodo = instanteNoFuso(inicio);
  const fimPeriodo = instanteNoFuso(somarDias(fim, 1));

  const ocupantes = reservas.filter((r) => STATUS_QUE_OCUPAM.includes(r.status));
  const ocupantesPorRecurso = new Map<string, ReservaBase[]>();
  for (const r of ocupantes) {
    const lista = ocupantesPorRecurso.get(r.recursoId) ?? [];
    lista.push(r);
    ocupantesPorRecurso.set(r.recursoId, lista);
  }

  // Contadores de períodos ocupados por recurso, turno e dia da semana
  const ocupadosRecurso = new Map<string, number>();
  const ocupadosTurno = new Map<string, number>();
  const ocupadosDiaSemana = new Map<number, number>();
  let periodosOcupados = 0;

  for (const dia of diasUteis) {
    for (const turno of turnos) {
      const { inicio: ini, fim: f } = periodoDoTurno(dia, turno);
      for (const recurso of recursos) {
        const ocupado = (ocupantesPorRecurso.get(recurso.id) ?? []).some(
          (r) => r.dataInicio < f && r.dataFim > ini
        );
        if (!ocupado) continue;
        periodosOcupados += 1;
        ocupadosRecurso.set(recurso.id, (ocupadosRecurso.get(recurso.id) ?? 0) + 1);
        ocupadosTurno.set(turno.id, (ocupadosTurno.get(turno.id) ?? 0) + 1);
        const ds = diaDaSemana(dia);
        ocupadosDiaSemana.set(ds, (ocupadosDiaSemana.get(ds) ?? 0) + 1);
      }
    }
  }

  const periodosPossiveis = diasUteis.length * turnos.length * recursos.length;
  const periodosPorRecurso = diasUteis.length * turnos.length;

  // Horas efetivamente reservadas de cada recurso dentro do período
  const horasReservadas = (recursoId: string) => {
    const ms = (ocupantesPorRecurso.get(recursoId) ?? []).reduce((total, r) => {
      const ini = Math.max(r.dataInicio.getTime(), comecoPeriodo.getTime());
      const f = Math.min(r.dataFim.getTime(), fimPeriodo.getTime());
      return total + Math.max(0, f - ini);
    }, 0);
    return Math.round((ms / 3_600_000) * 10) / 10;
  };

  const porRecurso = recursos
    .map((r) => {
      const ocupados = ocupadosRecurso.get(r.id) ?? 0;
      return {
        id: r.id,
        nome: r.nome,
        tipo: r.tipo,
        periodosOcupados: ocupados,
        taxa: porcentagem(ocupados, periodosPorRecurso),
        horasReservadas: horasReservadas(r.id),
      };
    })
    .sort((a, b) => b.taxa - a.taxa || b.horasReservadas - a.horasReservadas || a.nome.localeCompare(b.nome));

  const porTurno = turnos.map((t) => {
    const ocupados = ocupadosTurno.get(t.id) ?? 0;
    return {
      id: t.id,
      nome: t.nome,
      horaInicio: t.horaInicio,
      horaFim: t.horaFim,
      periodosOcupados: ocupados,
      taxa: porcentagem(ocupados, diasUteis.length * recursos.length),
    };
  });

  const porDiaDaSemana = DIAS_UTEIS.map((ds) => {
    const quantidadeDias = diasUteis.filter((d) => diaDaSemana(d) === ds).length;
    const ocupados = ocupadosDiaSemana.get(ds) ?? 0;
    return {
      dia: NOMES_DIAS[ds],
      periodosOcupados: ocupados,
      taxa: porcentagem(ocupados, quantidadeDias * turnos.length * recursos.length),
    };
  });

  // Pedidos de professores que começam no período (o uso institucional é
  // lançado pelo próprio admin e não passa pela aprovação)
  const pedidos = reservas.filter(
    (r) => !r.institucional && r.dataInicio >= comecoPeriodo && r.dataInicio < fimPeriodo
  );
  const contar = (...status: string[]) => pedidos.filter((p) => status.includes(p.status)).length;
  const aprovados = contar(...STATUS_QUE_OCUPAM);
  const recusados = contar('RECUSADA');

  const semanas = new Map<string, number>();
  for (const dia of dias) semanas.set(segundaDaSemana(dia), 0);
  for (const p of pedidos) {
    const semana = segundaDaSemana(dataNoFuso(p.dataInicio));
    semanas.set(semana, (semanas.get(semana) ?? 0) + 1);
  }

  // Ocorrências das reservas que terminam no período
  const terminamNoPeriodo = reservas.filter((r) => r.dataFim > comecoPeriodo && r.dataFim <= fimPeriodo);
  const tolerancia = TOLERANCIA_ATRASO_MIN * 60_000;
  const devolvidaComAtraso = (r: ReservaBase) =>
    r.devolvidoEm
      ? r.devolvidoEm.getTime() > r.dataFim.getTime() + tolerancia
      : r.status === 'EM_ANDAMENTO' && agora.getTime() > r.dataFim.getTime() + tolerancia;

  return {
    periodo: { inicio, fim, diasUteis: diasUteis.length },
    ocupacao: {
      taxa: porcentagem(periodosOcupados, periodosPossiveis),
      periodosOcupados,
      periodosPossiveis,
    },
    porRecurso,
    porTurno,
    porDiaDaSemana,
    pedidos: {
      total: pedidos.length,
      aprovados,
      pendentes: contar('PENDENTE'),
      recusados,
      cancelados: contar('CANCELADA'),
      taxaAprovacao: porcentagem(aprovados, aprovados + recusados),
    },
    pedidosPorSemana: [...semanas].map(([semana, total]) => ({ semana, total })),
    ocorrencias: {
      devolucoesAtrasadas: terminamNoPeriodo.filter(devolvidaComAtraso).length,
      devolucoesComProblema: terminamNoPeriodo.filter(
        (r) => r.condicaoDevolucao === 'COM_DEFEITO' || r.condicaoDevolucao === 'INCOMPLETO'
      ).length,
      // Aprovadas cujo horário já acabou sem que ninguém retirasse o recurso
      reservasNaoRetiradas: terminamNoPeriodo.filter((r) => r.status === 'APROVADA' && r.dataFim < agora)
        .length,
    },
  };
}
