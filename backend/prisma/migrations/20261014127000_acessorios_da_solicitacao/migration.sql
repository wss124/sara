-- CreateTable
CREATE TABLE "SolicitacaoAcessorio" (
    "solicitacaoId" TEXT NOT NULL,
    "acessorioId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "SolicitacaoAcessorio_pkey" PRIMARY KEY ("solicitacaoId","acessorioId")
);

-- AddForeignKey
ALTER TABLE "SolicitacaoAcessorio" ADD CONSTRAINT "SolicitacaoAcessorio_solicitacaoId_fkey" FOREIGN KEY ("solicitacaoId") REFERENCES "Solicitacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitacaoAcessorio" ADD CONSTRAINT "SolicitacaoAcessorio_acessorioId_fkey" FOREIGN KEY ("acessorioId") REFERENCES "Acessorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

