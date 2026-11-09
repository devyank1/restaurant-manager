import { Module } from '@nestjs/common';
import { EquipeModule } from '../equipe/equipe.module';
import { PushModule } from '../push/push.module';
import { AvisosEstoqueService } from './avisos-estoque.service';
import { EstoqueController } from './estoque.controller';
import { EstoqueService } from './estoque.service';

@Module({
  imports: [EquipeModule, PushModule],
  controllers: [EstoqueController],
  providers: [EstoqueService, AvisosEstoqueService],
  exports: [AvisosEstoqueService],
})
export class EstoqueModule {}
