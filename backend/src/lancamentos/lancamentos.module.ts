import { Module } from '@nestjs/common';
import { LancamentosService } from './lancamentos.service';
import { LancamentosController } from './lancamentos.controller';
import { ConfiguracoesModule } from '../configuracoes/configuracoes.module';

@Module({
  imports: [ConfiguracoesModule],
  controllers: [LancamentosController],
  providers: [LancamentosService],
  exports: [LancamentosService],
})
export class LancamentosModule {}
