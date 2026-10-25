// Regra de negócio violada dentro de uma transação; o controller devolve
// o status e a mensagem ao cliente.
export class ErroNegocio extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

// Nome da exclusion constraint criada na migration impede_reservas_sobrepostas
const CONSTRAINT_SOBREPOSICAO = 'Solicitacao_sem_sobreposicao';

// O Prisma não mapeia exclusion constraints para um código próprio; a violação
// chega como erro genérico com o nome da constraint (SQLSTATE 23P01).
// Quando duas aprovações sobrepostas gravam no mesmo instante, cada uma pode
// esperar pela outra na checagem da constraint: o PostgreSQL detecta o
// deadlock (40P01), aborta uma delas e deixa a outra seguir. Para o usuário,
// as duas situações são o mesmo conflito de horário.
export function violouSobreposicao(error: unknown) {
  const mensagem = error instanceof Error ? error.message : String(error);
  return (
    mensagem.includes(CONSTRAINT_SOBREPOSICAO) ||
    mensagem.includes('23P01') ||
    mensagem.includes('40P01')
  );
}
