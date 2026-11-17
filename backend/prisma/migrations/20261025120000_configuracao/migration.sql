-- CreateTable
CREATE TABLE "Configuracao" (
    "id" TEXT NOT NULL DEFAULT 'padrao',
    "antecedenciaMinHoras" INTEGER NOT NULL,
    "antecedenciaMaxDias" INTEGER NOT NULL,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("id")
);
