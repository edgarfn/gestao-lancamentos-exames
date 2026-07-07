import { Module } from '@nestjs/common';
import { AuditModule } from '../common/audit/audit.module';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ConfiguracoesController } from './configuracoes.controller';
import { ConfiguracoesService } from './configuracoes.service';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [ConfiguracoesController],
  providers: [ConfiguracoesService],
  exports: [ConfiguracoesService],
})
export class ConfiguracoesModule {}
