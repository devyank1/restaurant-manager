import { Module } from '@nestjs/common';
import { EquipeModule } from '../equipe/equipe.module';
import { PushModule } from '../push/push.module';
import { AvisosEstoqueService } from './avisos-estoque.service';
import { EstoqueController } from './estoque.controller';
import { EstoqueService } from './estoque.service';
import { ReceitasController } from './receitas.controller';
import { ReceitasService } from './receitas.service';

@Module({
  imports: [EquipeModule, PushModule],
  controllers: [EstoqueController, ReceitasController],
  providers: [EstoqueService, AvisosEstoqueService, ReceitasService],
  exports: [AvisosEstoqueService],
})
export class EstoqueModule {}
