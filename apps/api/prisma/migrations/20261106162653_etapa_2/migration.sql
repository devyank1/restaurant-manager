-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('DONO', 'GARCOM', 'COZINHA');

-- CreateEnum
CREATE TYPE "StatusSessao" AS ENUM ('ABERTA', 'FECHADA');

-- CreateEnum
CREATE TYPE "StatusRodada" AS ENUM ('AGUARDANDO_GARCOM', 'CONFIRMADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoChamado" AS ENUM ('ATENDENTE', 'CONFIRMAR_RODADA');

-- CreateEnum
CREATE TYPE "StatusChamado" AS ENUM ('ABERTO', 'LIDO', 'RESOLVIDO');

-- AlterTable
ALTER TABLE "Restaurante" ADD COLUMN     "janelaChamadoSegundos" INTEGER NOT NULL DEFAULT 60;

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "papel" "PapelUsuario" NOT NULL,
    "emTurno" BOOLEAN NOT NULL DEFAULT false,
    "emTurnoDesde" TIMESTAMP(3),
    "ultimoChamadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessaoMesa" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "mesaId" TEXT NOT NULL,
    "status" "StatusSessao" NOT NULL DEFAULT 'ABERTA',
    "garcomId" TEXT,
    "garcomDesde" TIMESTAMP(3),
    "abertaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechadaEm" TIMESTAMP(3),

    CONSTRAINT "SessaoMesa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispositivoSessao" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "dispositivoId" TEXT NOT NULL,
    "confirmado" BOOLEAN NOT NULL DEFAULT false,
    "entrouEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DispositivoSessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemCarrinho" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "pratoId" TEXT NOT NULL,
    "selecao" JSONB NOT NULL,
    "observacao" TEXT NOT NULL DEFAULT '',
    "quantidade" INTEGER NOT NULL,
    "adicionadoPor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemCarrinho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rodada" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "dispositivoId" TEXT NOT NULL,
    "status" "StatusRodada" NOT NULL,
    "totalCentavos" INTEGER NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmadaEm" TIMESTAMP(3),
    "confirmadaPorId" TEXT,

    CONSTRAINT "Rodada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemRodada" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "rodadaId" TEXT NOT NULL,
    "pratoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "resumoOpcoes" TEXT NOT NULL,
    "selecao" JSONB NOT NULL,
    "observacao" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "precoUnitarioCentavos" INTEGER NOT NULL,

    CONSTRAINT "ItemRodada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chamado" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "mesaId" TEXT NOT NULL,
    "sessaoId" TEXT NOT NULL,
    "tipo" "TipoChamado" NOT NULL,
    "rodadaId" TEXT,
    "garcomId" TEXT,
    "status" "StatusChamado" NOT NULL DEFAULT 'ABERTO',
    "tentativas" INTEGER NOT NULL DEFAULT 1,
    "paraTodos" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atribuidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lidoEm" TIMESTAMP(3),
    "resolvidoEm" TIMESTAMP(3),

    CONSTRAINT "Chamado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InscricaoPush" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InscricaoPush_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_restauranteId_idx" ON "Usuario"("restauranteId");

-- CreateIndex
CREATE INDEX "SessaoMesa_mesaId_status_idx" ON "SessaoMesa"("mesaId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DispositivoSessao_sessaoId_dispositivoId_key" ON "DispositivoSessao"("sessaoId", "dispositivoId");

-- CreateIndex
CREATE INDEX "Chamado_restauranteId_status_idx" ON "Chamado"("restauranteId", "status");

-- CreateIndex
CREATE INDEX "Evento_restauranteId_tipo_idx" ON "Evento"("restauranteId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "InscricaoPush_endpoint_key" ON "InscricaoPush"("endpoint");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoMesa" ADD CONSTRAINT "SessaoMesa_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessaoMesa" ADD CONSTRAINT "SessaoMesa_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispositivoSessao" ADD CONSTRAINT "DispositivoSessao_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "SessaoMesa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCarrinho" ADD CONSTRAINT "ItemCarrinho_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "SessaoMesa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rodada" ADD CONSTRAINT "Rodada_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "SessaoMesa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemRodada" ADD CONSTRAINT "ItemRodada_rodadaId_fkey" FOREIGN KEY ("rodadaId") REFERENCES "Rodada"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_mesaId_fkey" FOREIGN KEY ("mesaId") REFERENCES "Mesa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chamado" ADD CONSTRAINT "Chamado_sessaoId_fkey" FOREIGN KEY ("sessaoId") REFERENCES "SessaoMesa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InscricaoPush" ADD CONSTRAINT "InscricaoPush_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
