import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { extractAuditContext } from '../common/decorators/request-context';
import { PacientesService } from './pacientes.service';
import { CreatePacienteDto } from './dto/create-paciente.dto';
import { UpdatePacienteDto } from './dto/update-paciente.dto';
import { QueryPacienteDto } from './dto/query-paciente.dto';

@ApiBearerAuth()
@ApiTags('Pacientes')
@Controller({ path: 'pacientes', version: '1' })
export class PacientesController {
  constructor(private readonly service: PacientesService) {}

  @Roles('ADMIN', 'GESTOR', 'TECNICO')
  @Post()
  criar(@Body() dto: CreatePacienteDto, @Req() req: Request) {
    return this.service.criar(dto, extractAuditContext(req));
  }

  @Get()
  listar(@Query() query: QueryPacienteDto) {
    return this.service.listar(query);
  }

  @Get(':id')
  buscar(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.service.buscarPorId(id, extractAuditContext(req));
  }

  @Roles('ADMIN', 'GESTOR')
  @Patch(':id')
  atualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePacienteDto, @Req() req: Request) {
    return this.service.atualizar(id, dto, extractAuditContext(req));
  }

  @Roles('ADMIN', 'GESTOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remover(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request): Promise<void> {
    await this.service.remover(id, extractAuditContext(req));
  }

  @Roles('ADMIN', 'GESTOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Post(':id/anonimizar')
  async anonimizar(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request): Promise<void> {
    await this.service.anonimizar(id, extractAuditContext(req));
  }
}
