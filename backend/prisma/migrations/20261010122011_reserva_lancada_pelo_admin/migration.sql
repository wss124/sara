-- AlterTable
ALTER TABLE "Solicitacao" ADD COLUMN     "institucional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lancadoPorId" TEXT;

-- AddForeignKey
ALTER TABLE "Solicitacao" ADD CONSTRAINT "Solicitacao_lancadoPorId_fkey" FOREIGN KEY ("lancadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
