import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { extractAuditContext } from '../common/decorators/request-context';
import { EspecialidadesService } from './especialidades.service';
import { CreateEspecialidadeDto } from './dto/create-especialidade.dto';
import { UpdateEspecialidadeDto } from './dto/update-especialidade.dto';
import { QueryEspecialidadeDto } from './dto/query-especialidade.dto';

@ApiBearerAuth()
@ApiTags('Especialidades')
@Controller({ path: 'especialidades', version: '1' })
export class EspecialidadesController {
  constructor(private readonly service: EspecialidadesService) {}

  @Roles('ADMIN', 'GESTOR')
  @Post()
  criar(@Body() dto: CreateEspecialidadeDto, @Req() req: Request) {
    return this.service.criar(dto, extractAuditContext(req));
  }

  @Get()
  listar(@Query() query: QueryEspecialidadeDto) {
    return this.service.listar(query);
  }

  @Get('selecao')
  listarParaSelecao() {
    return this.service.listarParaSelecao();
  }

  @Get(':id')
  buscar(@Param('id') id: string) {
    return this.service.buscarPorId(id);
  }

  @Roles('ADMIN', 'GESTOR')
  @Patch(':id')
  atualizar(@Param('id') id: string, @Body() dto: UpdateEspecialidadeDto, @Req() req: Request) {
    return this.service.atualizar(id, dto, extractAuditContext(req));
  }

  @Roles('ADMIN', 'GESTOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remover(@Param('id') id: string, @Req() req: Request): Promise<void> {
    await this.service.remover(id, extractAuditContext(req));
  }
}
