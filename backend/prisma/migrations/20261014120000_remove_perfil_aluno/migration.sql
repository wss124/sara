-- Só professores (e administradores) usam o sistema: contas de aluno
-- existentes passam a professor antes de o valor sair do enum.
UPDATE "Usuario" SET "perfil" = 'PROFESSOR' WHERE "perfil" = 'ALUNO';

-- AlterEnum
BEGIN;
CREATE TYPE "Perfil_new" AS ENUM ('PROFESSOR', 'ADMIN');
ALTER TABLE "public"."Usuario" ALTER COLUMN "perfil" DROP DEFAULT;
ALTER TABLE "Usuario" ALTER COLUMN "perfil" TYPE "Perfil_new" USING ("perfil"::text::"Perfil_new");
ALTER TYPE "Perfil" RENAME TO "Perfil_old";
ALTER TYPE "Perfil_new" RENAME TO "Perfil";
DROP TYPE "public"."Perfil_old";
ALTER TABLE "Usuario" ALTER COLUMN "perfil" SET DEFAULT 'PROFESSOR';
COMMIT;
