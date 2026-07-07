import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { Request, Response } from 'express';
import { tmpdir } from 'os';
import { Roles } from '../auth/decorators/roles.decorator';
import { extractAuditContext } from '../common/decorators/request-context';
import { BackupService } from './backup.service';

interface ArquivoEnviado {
  originalname: string;
  path: string;
  size: number;
}

class CriarBackupDto {
  @IsOptional()
  @IsBoolean()
  criptografar?: boolean;
}

const TAMANHO_MAXIMO_RESTAURACAO_BYTES = 1024 * 1024 * 1024; // 1 GiB

/**
 * Backup e restauração do banco de dados — restrito aos papéis ADMIN e GESTOR.
 * Toda criação, download, exclusão e (especialmente) restauração é
 * registrada em audit_logs pelo BackupService, dado o impacto e o
 * caráter potencialmente destrutivo dessas operações.
 */
@ApiBearerAuth()
@ApiTags('Backup')
@Roles('ADMIN', 'GESTOR')
@Controller({ path: 'backup', version: '1' })
export class BackupController {
  constructor(private readonly service: BackupService) {}

  @Get()
  listar() {
    return this.service.listar();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  criar(@Body() dto: CriarBackupDto, @Req() req: Request) {
    return this.service.criar(extractAuditContext(req), dto.criptografar ?? false);
  }

  @Get(':nome/download')
  @Header('Content-Type', 'application/octet-stream')
  async baixar(
    @Param('nome') nome: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const arquivo = await this.service.baixar(nome);
    res.set('Content-Disposition', `attachment; filename="${nome}"`);
    return arquivo;
  }

  @Delete(':nome')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remover(@Param('nome') nome: string, @Req() req: Request): Promise<void> {
    await this.service.remover(nome, extractAuditContext(req));
  }

  @Post('restaurar')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('arquivo', {
      dest: tmpdir(),
      limits: { fileSize: TAMANHO_MAXIMO_RESTAURACAO_BYTES },
      fileFilter: (_req, file, callback) => {
        const nome = file.originalname.toLowerCase();
        callback(null, nome.endsWith('.dump') || nome.endsWith('.dump.enc'));
      },
    }),
  )
  async restaurar(@UploadedFile() arquivo: ArquivoEnviado | undefined, @Req() req: Request): Promise<void> {
    if (!arquivo) {
      throw new BadRequestException('Envie um arquivo de backup (.dump ou .dump.enc) válido para restaurar.');
    }
    await this.service.restaurar(arquivo.path, arquivo.originalname, extractAuditContext(req));
  }
}
