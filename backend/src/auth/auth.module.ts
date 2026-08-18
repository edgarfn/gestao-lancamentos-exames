import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { TurnstileService } from './turnstile.service';
import { EmailService } from './email.service';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { TrocaSenhaObrigatoriaGuard } from './guards/troca-senha-obrigatoria.guard';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    TurnstileService,
    EmailService,
    JwtAccessStrategy,
    JwtRefreshStrategy,
    // Guards globais: autenticação obrigatória por padrão (JwtAuthGuard)
    // seguida de checagem de papéis (RolesGuard) e, por fim, do bloqueio de
    // contas com troca de senha pendente (TrocaSenhaObrigatoriaGuard) — a
    // ordem importa, pois os dois últimos dependem de req.user já populado
    // pelo guard de autenticação.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: TrocaSenhaObrigatoriaGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
