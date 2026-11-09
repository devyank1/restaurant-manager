import { Module } from '@nestjs/common';
import { EquipeModule } from '../equipe/equipe.module';
import { PushModule } from '../push/push.module';
import { AvisosEstoqueService } from './avisos-estoque.service';
import { ComprasController } from './compras.controller';
import { ComprasService } from './compras.service';
import { EstoqueController } from './estoque.controller';
import { EstoqueService } from './estoque.service';
import { ReceitasController } from './receitas.controller';
import { ReceitasService } from './receitas.service';

@Module({
  imports: [EquipeModule, PushModule],
  controllers: [EstoqueController, ReceitasController, ComprasController],
  providers: [
    EstoqueService,
    AvisosEstoqueService,
    ReceitasService,
    ComprasService,
  ],
  exports: [AvisosEstoqueService],
})
export class EstoqueModule {}
