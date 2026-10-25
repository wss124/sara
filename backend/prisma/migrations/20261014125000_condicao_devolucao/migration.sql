-- CreateEnum
CREATE TYPE "CondicaoDevolucao" AS ENUM ('OK', 'COM_DEFEITO', 'INCOMPLETO');

-- AlterTable
ALTER TABLE "Solicitacao" ADD COLUMN     "condicaoDevolucao" "CondicaoDevolucao",
ADD COLUMN     "motivoCancelamento" TEXT,
ADD COLUMN     "observacaoDevolucao" TEXT;

