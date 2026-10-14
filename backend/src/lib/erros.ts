// Nome da exclusion constraint criada na migration impede_reservas_sobrepostas
const CONSTRAINT_SOBREPOSICAO = 'Solicitacao_sem_sobreposicao';

// O Prisma não mapeia exclusion constraints para um código próprio; a violação
// chega como erro genérico com o nome da constraint (SQLSTATE 23P01).
export function violouSobreposicao(error: unknown) {
  const mensagem = error instanceof Error ? error.message : String(error);
  return mensagem.includes(CONSTRAINT_SOBREPOSICAO) || mensagem.includes('23P01');
}
