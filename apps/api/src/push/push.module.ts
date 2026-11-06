import { Module } from '@nestjs/common';
import { EquipeModule } from '../equipe/equipe.module';
import { PushController } from './push.controller';
import { PushListener } from './push.listener';
import { PushService } from './push.service';

@Module({
  imports: [EquipeModule],
  controllers: [PushController],
  providers: [PushService, PushListener],
  exports: [PushService],
})
export class PushModule {}
