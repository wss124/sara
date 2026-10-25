-- AlterTable
ALTER TABLE "Solicitacao" ADD COLUMN     "lembreteDevolucaoEnviadoEm" TIMESTAMP(3),
ADD COLUMN     "lembreteRetiradaEnviadoEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RotinaExecucao" (
    "chave" TEXT NOT NULL,
    "executadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RotinaExecucao_pkey" PRIMARY KEY ("chave")
);

