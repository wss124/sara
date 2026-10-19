// Fila de pedidos concorrentes: pedidos pendentes do mesmo recurso com
// horários sobrepostos disputam a mesma vaga. A decisão continua com o admin;
// a fila só mostra a ordem de chegada para orientar a escolha.

interface PedidoNaFila {
  id: string;
  recursoId: string;
  dataInicio: Date;
  dataFim: Date;
  criadoEm: Date;
}

export function disputamOMesmoHorario(a: PedidoNaFila, b: PedidoNaFila) {
  return (
    a.id !== b.id && a.recursoId === b.recursoId && a.dataInicio < b.dataFim && b.dataInicio < a.dataFim
  );
}

function chegouAntes(a: PedidoNaFila, b: PedidoNaFila) {
  const diferenca = a.criadoEm.getTime() - b.criadoEm.getTime();
  return diferenca < 0 || (diferenca === 0 && a.id < b.id);
}

export interface PosicaoNaFila<T> {
  // 1 = pedido mais antigo entre os que disputam o horário
  posicao: number;
  total: number;
  // Os outros pedidos que disputam o horário, do mais antigo ao mais novo
  concorrentes: T[];
}

// Posição de cada pedido entre os que se sobrepõem a ele. Pedidos sem
// concorrentes ficam fora do mapa.
export function montarFila<T extends PedidoNaFila>(pendentes: T[]) {
  const fila = new Map<string, PosicaoNaFila<T>>();
  for (const pedido of pendentes) {
    const concorrentes = pendentes
      .filter((outro) => disputamOMesmoHorario(pedido, outro))
      .sort((a, b) => (chegouAntes(a, b) ? -1 : 1));
    if (concorrentes.length === 0) continue;
    fila.set(pedido.id, {
      posicao: 1 + concorrentes.filter((c) => chegouAntes(c, pedido)).length,
      total: concorrentes.length + 1,
      concorrentes,
    });
  }
  return fila;
}
