import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { extractAuditContext } from '../common/decorators/request-context';
import { ConfiguracoesService } from './configuracoes.service';
import { UpdateConfiguracaoDto } from './dto/update-configuracao.dto';

interface ArquivoEnviado {
  originalname: string;
  buffer: Buffer;
  size: number;
}

const TAMANHO_MAXIMO_LOGO_BYTES = 2 * 1024 * 1024; // 2 MiB

/**
 * Configurações da clínica — nome, logotipo e dados de contato.
 * Leitura aberta a qualquer usuário autenticado (para exibir logo no cabeçalho).
 * Escrita restrita ao papel ADMIN.
 */
@ApiBearerAuth()
@ApiTags('Configurações')
@Roles()
@Controller({ path: 'configuracoes', version: '1' })
export class ConfiguracoesController {
  constructor(private readonly service: ConfiguracoesService) {}

  @Public()
  @Get('publica')
  obterPublica(): Promise<{ nomeClinica: string | null; logoBase64: string | null }> {
    return this.service.obterPublica();
  }

  @Get()
  obter() {
    return this.service.obter();
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  atualizar(@Body() dto: UpdateConfiguracaoDto, @Req() req: Request) {
    return this.service.atualizar(dto, extractAuditContext(req));
  }

  @Post('logo')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('arquivo', {
      storage: require('multer').memoryStorage(),
      limits: { fileSize: TAMANHO_MAXIMO_LOGO_BYTES },
    }),
  )
  async salvarLogo(
    @UploadedFile() arquivo: ArquivoEnviado | undefined,
    @Req() req: Request,
  ) {
    if (!arquivo) {
      throw new BadRequestException('Envie um arquivo de imagem (PNG, JPG, SVG ou WebP).');
    }
    return this.service.salvarLogo(arquivo.buffer, arquivo.originalname, extractAuditContext(req));
  }

  @Get('logo')
  async obterLogo(@Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
    const { stream, contentType } = await this.service.obterLogo();
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=3600');
    return stream;
  }
}
