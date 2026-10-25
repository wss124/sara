-- CreateTable
CREATE TABLE "Acessorio" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "localizacao" TEXT,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Acessorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecursoAcessorio" (
    "recursoId" TEXT NOT NULL,
    "acessorioId" TEXT NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RecursoAcessorio_pkey" PRIMARY KEY ("recursoId","acessorioId")
);

-- AddForeignKey
ALTER TABLE "RecursoAcessorio" ADD CONSTRAINT "RecursoAcessorio_recursoId_fkey" FOREIGN KEY ("recursoId") REFERENCES "Recurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecursoAcessorio" ADD CONSTRAINT "RecursoAcessorio_acessorioId_fkey" FOREIGN KEY ("acessorioId") REFERENCES "Acessorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

