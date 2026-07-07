import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './types/authenticated-user';
import { RefreshTokenContext } from './strategies/jwt-refresh.strategy';

@ApiTags('Autenticação')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const socket = req.socket as { remoteAddress?: string } | undefined;
    return this.authService.login(dto.email, dto.senha, dto.turnstileToken, {
      enderecoIp: req.ip ?? null,
      enderecoIpProxy: socket?.remoteAddress ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
  }

  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refresh(@Body() _dto: RefreshTokenDto, @Req() req: Request) {
    const { userId } = req.user as unknown as RefreshTokenContext;
    return this.authService.renovarTokens(userId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout-all')
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.authService.revogarSessoes(user.id);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('alterar-senha')
  async alterarSenha(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.authService.alterarSenha(user.id, dto.senhaAtual, dto.novaSenha);
  }
}
