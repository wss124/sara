-- Garante no próprio banco que um recurso nunca tenha duas reservas ativas
-- com períodos sobrepostos, mesmo que duas aprovações aconteçam ao mesmo
-- tempo. O intervalo é fechado no início e aberto no fim ('[)'), então uma
-- reserva que termina às 10:00 não conflita com outra que começa às 10:00.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Solicitacao"
  ADD CONSTRAINT "Solicitacao_sem_sobreposicao"
  EXCLUDE USING gist (
    "recursoId" WITH =,
    tsrange("dataInicio", "dataFim") WITH &&
  )
  WHERE ("status" = 'APROVADA');
