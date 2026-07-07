import { Module } from '@nestjs/common';
import { TecnicosService } from './tecnicos.service';
import { TecnicosController } from './tecnicos.controller';

@Module({
  controllers: [TecnicosController],
  providers: [TecnicosService],
  exports: [TecnicosService],
})
export class TecnicosModule {}
