-- CreateEnum
CREATE TYPE "FormaPagamento" AS ENUM ('CARTAO', 'PIX', 'DINHEIRO');

-- AlterTable
ALTER TABLE "Restaurante" ADD COLUMN     "couvertCentavos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "couvertHabilitado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "couvertPadrao" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "servicoHabilitado" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "servicoPadrao" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "SessaoMesa" ADD COLUMN     "couvertCentavos" INTEGER,
ADD COLUMN     "fechadaPorId" TEXT,
ADD COLUMN     "formaPagamento" "FormaPagamento",
ADD COLUMN     "pessoas" INTEGER,
ADD COLUMN     "servicoCentavos" INTEGER,
ADD COLUMN     "subtotalCentavos" INTEGER,
ADD COLUMN     "totalCentavos" INTEGER;
