-- CreateEnum
CREATE TYPE "UnidadeEstoque" AS ENUM ('UN', 'G', 'ML');

-- CreateEnum
CREATE TYPE "TipoMovimento" AS ENUM ('VENDA', 'ESTORNO', 'ENTRADA', 'CONTAGEM', 'PERDA');

-- CreateEnum
CREATE TYPE "MotivoPerda" AS ENUM ('ACIDENTE', 'VALIDADE', 'PREPARO', 'OUTRO');

-- CreateEnum
CREATE TYPE "NivelEstoque" AS ENUM ('OK', 'ACABANDO', 'ZERADO');

-- AlterTable
ALTER TABLE "Opcao" ADD COLUMN     "multiplicadorPct" INTEGER NOT NULL DEFAULT 100;

-- CreateTable
CREATE TABLE "Fornecedor" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fornecedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemEstoque" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" "UnidadeEstoque" NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    "minimo" INTEGER NOT NULL DEFAULT 0,
    "cheio" INTEGER NOT NULL DEFAULT 0,
    "fornecedorId" TEXT,
    "embalagemNome" TEXT,
    "embalagemQuantidade" INTEGER,
    "nivel" "NivelEstoque" NOT NULL DEFAULT 'OK',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceitaItem" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "pratoId" TEXT,
    "opcaoId" TEXT,
    "itemId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,

    CONSTRAINT "ReceitaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MovimentoEstoque" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "tipo" "TipoMovimento" NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "motivo" "MotivoPerda",
    "observacao" TEXT,
    "usuarioId" TEXT,
    "rodadaId" TEXT,
    "lote" TEXT NOT NULL,
    "desfeitoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListaCompra" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "itens" JSONB NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chegouEm" TIMESTAMP(3),

    CONSTRAINT "ListaCompra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Fornecedor_restauranteId_idx" ON "Fornecedor"("restauranteId");

-- CreateIndex
CREATE UNIQUE INDEX "ItemEstoque_restauranteId_nome_key" ON "ItemEstoque"("restauranteId", "nome");

-- CreateIndex
CREATE UNIQUE INDEX "ReceitaItem_pratoId_itemId_key" ON "ReceitaItem"("pratoId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ReceitaItem_opcaoId_itemId_key" ON "ReceitaItem"("opcaoId", "itemId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_restauranteId_criadoEm_idx" ON "MovimentoEstoque"("restauranteId", "criadoEm");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_rodadaId_idx" ON "MovimentoEstoque"("rodadaId");

-- CreateIndex
CREATE INDEX "MovimentoEstoque_lote_idx" ON "MovimentoEstoque"("lote");

-- CreateIndex
CREATE INDEX "ListaCompra_restauranteId_criadaEm_idx" ON "ListaCompra"("restauranteId", "criadaEm");

-- AddForeignKey
ALTER TABLE "Fornecedor" ADD CONSTRAINT "Fornecedor_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEstoque" ADD CONSTRAINT "ItemEstoque_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemEstoque" ADD CONSTRAINT "ItemEstoque_fornecedorId_fkey" FOREIGN KEY ("fornecedorId") REFERENCES "Fornecedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceitaItem" ADD CONSTRAINT "ReceitaItem_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceitaItem" ADD CONSTRAINT "ReceitaItem_pratoId_fkey" FOREIGN KEY ("pratoId") REFERENCES "Prato"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceitaItem" ADD CONSTRAINT "ReceitaItem_opcaoId_fkey" FOREIGN KEY ("opcaoId") REFERENCES "Opcao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceitaItem" ADD CONSTRAINT "ReceitaItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemEstoque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemEstoque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListaCompra" ADD CONSTRAINT "ListaCompra_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
