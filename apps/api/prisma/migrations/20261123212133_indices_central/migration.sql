-- CreateIndex
CREATE INDEX "Rodada_restauranteId_status_confirmadaEm_idx" ON "Rodada"("restauranteId", "status", "confirmadaEm");

-- CreateIndex
CREATE INDEX "SessaoMesa_restauranteId_status_idx" ON "SessaoMesa"("restauranteId", "status");
