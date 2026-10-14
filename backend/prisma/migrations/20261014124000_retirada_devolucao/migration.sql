-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatusSolicitacao" ADD VALUE 'EM_ANDAMENTO';
ALTER TYPE "StatusSolicitacao" ADD VALUE 'CONCLUIDA';
ALTER TYPE "StatusSolicitacao" ADD VALUE 'CANCELADA';

-- AlterTable
ALTER TABLE "Solicitacao" ADD COLUMN     "canceladoEm" TIMESTAMP(3),
ADD COLUMN     "devolucaoRegistradaPorId" TEXT,
ADD COLUMN     "devolvidoEm" TIMESTAMP(3),
ADD COLUMN     "retiradaRegistradaPorId" TEXT,
ADD COLUMN     "retiradoEm" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_retiradaRegistradaPorId_fkey" FOREIGN KEY ("retiradaRegistradaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_devolucaoRegistradaPorId_fkey" FOREIGN KEY ("devolucaoRegistradaPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

