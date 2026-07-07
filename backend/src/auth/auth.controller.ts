import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { SolicitarRecuperacaoDto } from './dto/solicitar-recuperacao.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';
import { SetupInicialDto } from './dto/setup-inicial.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './types/authenticated-user';
import { RefreshTokenContext } from './strategies/jwt-refresh.strategy';

@ApiTags('Autenticação')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 3 tentativas / 15 min — anti brute-force e credential stuffing
  @Public()
  @Throttle({ global: { ttl: 15 * 60_000, limit: 3 } })
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

  // 10 tentativas / min — renovação de token (operação legítima frequente)
  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @Throttle({ global: { ttl: 60_000, limit: 10 } })
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

  // Checagem pública frequente — limit alto, não é vetor de ataque
  @Public()
  @HttpCode(HttpStatus.OK)
  @Get('precisa-configuracao')
  async precisaConfiguracao(): Promise<{ precisaConfiguracao: boolean }> {
    return { precisaConfiguracao: await this.authService.precisaConfiguracao() };
  }

  // 2 tentativas / hora — operação única de bootstrap do sistema
  @Public()
  @Throttle({ global: { ttl: 60 * 60_000, limit: 2 } })
  @HttpCode(HttpStatus.CREATED)
  @Post('configuracao-inicial')
  async configuracaoInicial(@Body() dto: SetupInicialDto): Promise<void> {
    await this.authService.configuracaoInicial(dto.nome, dto.email, dto.senha);
  }

  // 3 tentativas / 5 min — anti spam de e-mail e enumeração de usuários
  @Public()
  @Throttle({ global: { ttl: 5 * 60_000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @Post('solicitar-recuperacao')
  async solicitarRecuperacao(@Body() dto: SolicitarRecuperacaoDto): Promise<{ mensagem: string }> {
    const mensagem = await this.authService.solicitarRecuperacaoSenha(dto.email);
    return { mensagem };
  }

  // 5 tentativas / 5 min — token de uso único, janela curta
  @Public()
  @Throttle({ global: { ttl: 5 * 60_000, limit: 5 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('redefinir-senha')
  async redefinirSenha(@Body() dto: RedefinirSenhaDto): Promise<void> {
    await this.authService.redefinirSenha(dto.token, dto.novaSenha);
  }
}
