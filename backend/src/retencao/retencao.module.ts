import { Module } from '@nestjs/common';
import { RetencaoService } from './retencao.service';

@Module({
  providers: [RetencaoService],
})
export class RetencaoModule {}
