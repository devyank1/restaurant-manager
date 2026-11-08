-- CreateEnum
CREATE TYPE "StatusItem" AS ENUM ('NA_FILA', 'EM_PREPARO', 'PRONTO', 'ENTREGUE');

-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN     "estacao" TEXT NOT NULL DEFAULT 'Cozinha';

-- AlterTable
ALTER TABLE "ItemRodada" ADD COLUMN     "emPreparoEm" TIMESTAMP(3),
ADD COLUMN     "entregueEm" TIMESTAMP(3),
ADD COLUMN     "estacao" TEXT NOT NULL DEFAULT 'Cozinha',
ADD COLUMN     "prontoEm" TIMESTAMP(3),
ADD COLUMN     "status" "StatusItem" NOT NULL DEFAULT 'NA_FILA';

-- AlterTable
ALTER TABLE "Prato" ADD COLUMN     "exigeConfirmacao" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Restaurante" ADD COLUMN     "janelaCancelamentoSegundos" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "limiteConfirmacaoCentavos" INTEGER;

-- AlterTable
ALTER TABLE "Rodada" ADD COLUMN     "canceladaEm" TIMESTAMP(3),
ADD COLUMN     "direta" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ItemRodada_restauranteId_estacao_status_idx" ON "ItemRodada"("restauranteId", "estacao", "status");

-- Rodadas confirmadas antes da produção existir: contam como entregues
-- (não inundam a tela da cozinha com pedidos antigos).
UPDATE "ItemRodada" SET "status" = 'ENTREGUE', "entregueEm" = CURRENT_TIMESTAMP
WHERE "rodadaId" IN (SELECT "id" FROM "Rodada" WHERE "status" = 'CONFIRMADA');
