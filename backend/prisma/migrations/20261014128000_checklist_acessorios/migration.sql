-- AlterTable
ALTER TABLE "Acessorio" ADD COLUMN     "emFalta" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Solicitacao" ADD COLUMN     "observacaoRetirada" TEXT;

-- AlterTable
ALTER TABLE "SolicitacaoAcessorio" ADD COLUMN     "devolvido" BOOLEAN,
ADD COLUMN     "entregue" BOOLEAN NOT NULL DEFAULT false;

