-- CreateEnum
CREATE TYPE "EstadoRecurso" AS ENUM ('DISPONIVEL', 'EM_USO', 'EM_MANUTENCAO', 'INDISPONIVEL');

-- AlterTable
ALTER TABLE "Recurso" ADD COLUMN     "estado" "EstadoRecurso" NOT NULL DEFAULT 'DISPONIVEL';

