import { Module } from '@nestjs/common';
import { SessaoMesaController } from './sessao-mesa.controller';
import { SessaoMesaService } from './sessao-mesa.service';

@Module({
  controllers: [SessaoMesaController],
  providers: [SessaoMesaService],
  exports: [SessaoMesaService],
})
export class SessaoMesaModule {}
