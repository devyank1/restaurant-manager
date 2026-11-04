-- CreateEnum
CREATE TYPE "TipoGrupoOpcao" AS ENUM ('UNICA', 'MULTIPLA', 'SABORES');

-- CreateTable
CREATE TABLE "Restaurante" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "wifiSsid" TEXT,
    "wifiSenha" TEXT,
    "googleAvaliacaoUrl" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Restaurante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mesa" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prato" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "precoCentavos" INTEGER NOT NULL,
    "precoPromocionalCentavos" INTEGER,
    "destaque" BOOLEAN NOT NULL DEFAULT false,
    "esgotado" BOOLEAN NOT NULL DEFAULT false,
    "videoUrl" TEXT,
    "posterUrl" TEXT,
    "ordem" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrupoOpcao" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "pratoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoGrupoOpcao" NOT NULL,
    "obrigatorio" BOOLEAN NOT NULL,
    "min" INTEGER NOT NULL,
    "max" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrupoOpcao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opcao" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "precoCentavos" INTEGER NOT NULL,
    "precoPromocionalCentavos" INTEGER,
    "ordem" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opcao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Restaurante_slug_key" ON "Restaurante"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Mesa_token_key" ON "Mesa"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Mesa_restauranteId_numero_key" ON "Mesa"("restauranteId", "numero");

-- AddForeignKey
ALTER TABLE "Mesa" ADD CONSTRAINT "Mesa_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prato" ADD CONSTRAINT "Prato_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prato" ADD CONSTRAINT "Prato_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoOpcao" ADD CONSTRAINT "GrupoOpcao_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrupoOpcao" ADD CONSTRAINT "GrupoOpcao_pratoId_fkey" FOREIGN KEY ("pratoId") REFERENCES "Prato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opcao" ADD CONSTRAINT "Opcao_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opcao" ADD CONSTRAINT "Opcao_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "GrupoOpcao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
