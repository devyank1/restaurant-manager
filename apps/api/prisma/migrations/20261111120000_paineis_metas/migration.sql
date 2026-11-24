-- Etapa 4B: painéis e metas. Só acrescenta; o backfill não apaga nada.

CREATE TYPE "EscopoMeta" AS ENUM ('EQUIPE', 'GARCOM', 'ESTACAO');
CREATE TYPE "TipoMeta" AS ENUM ('VALOR', 'MESAS', 'NO_TEMPO', 'ESQUECIDOS');
CREATE TYPE "PeriodoMeta" AS ENUM ('DIA', 'SEMANA');

ALTER TABLE "Restaurante" ADD COLUMN "horasSemPausa" INTEGER NOT NULL DEFAULT 4;
ALTER TABLE "Categoria" ADD COLUMN "tempoPreparoMin" INTEGER;
ALTER TABLE "Prato" ADD COLUMN "tempoPreparoMin" INTEGER;
ALTER TABLE "Rodada" ADD COLUMN "garcomId" TEXT;
ALTER TABLE "ItemRodada" ADD COLUMN "tempoEsperadoMin" INTEGER NOT NULL DEFAULT 15;

CREATE TABLE "TurnoEquipe" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fim" TIMESTAMP(3),
    CONSTRAINT "TurnoEquipe_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TurnoEquipe_restauranteId_inicio_idx" ON "TurnoEquipe"("restauranteId", "inicio");
CREATE INDEX "TurnoEquipe_usuarioId_fim_idx" ON "TurnoEquipe"("usuarioId", "fim");
ALTER TABLE "TurnoEquipe" ADD CONSTRAINT "TurnoEquipe_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TurnoEquipe" ADD CONSTRAINT "TurnoEquipe_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Meta" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "escopo" "EscopoMeta" NOT NULL,
    "tipo" "TipoMeta" NOT NULL,
    "periodo" "PeriodoMeta" NOT NULL,
    "alvo" INTEGER NOT NULL,
    "usuarioId" TEXT,
    "estacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Meta_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Meta_restauranteId_escopo_idx" ON "Meta"("restauranteId", "escopo");
ALTER TABLE "Meta" ADD CONSTRAINT "Meta_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: crédito das rodadas já confirmadas = garçom atual da sessão.
UPDATE "Rodada" r SET "garcomId" = s."garcomId"
FROM "SessaoMesa" s
WHERE r."sessaoId" = s."id" AND r."confirmadaEm" IS NOT NULL AND r."garcomId" IS NULL;

-- Backfill: quem já está em turno ganha o turno aberto.
INSERT INTO "TurnoEquipe" ("id", "restauranteId", "usuarioId", "inicio")
SELECT gen_random_uuid()::text, u."restauranteId", u."id", u."emTurnoDesde"
FROM "Usuario" u
WHERE u."emTurno" = true AND u."emTurnoDesde" IS NOT NULL;
