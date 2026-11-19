-- CreateTable
CREATE TABLE "LimiteAlerta" (
    "id" TEXT NOT NULL,
    "restauranteId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "valor" INTEGER,

    CONSTRAINT "LimiteAlerta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LimiteAlerta_restauranteId_tipo_key" ON "LimiteAlerta"("restauranteId", "tipo");

-- AddForeignKey
ALTER TABLE "LimiteAlerta" ADD CONSTRAINT "LimiteAlerta_restauranteId_fkey" FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id") ON DELETE CASCADE ON UPDATE CASCADE;
