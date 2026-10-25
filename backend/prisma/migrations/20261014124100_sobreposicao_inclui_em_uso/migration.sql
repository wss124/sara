-- Uma reserva já retirada (EM_ANDAMENTO) continua ocupando o horário.
-- Fica em migration separada porque o PostgreSQL não deixa usar um valor de
-- enum na mesma transação em que ele foi criado.
ALTER TABLE "Solicitacao" DROP CONSTRAINT "Solicitacao_sem_sobreposicao";

ALTER TABLE "Solicitacao"
  ADD CONSTRAINT "Solicitacao_sem_sobreposicao"
  EXCLUDE USING gist (
    "recursoId" WITH =,
    tsrange("dataInicio", "dataFim") WITH &&
  )
  WHERE ("status" IN ('APROVADA', 'EM_ANDAMENTO'));
