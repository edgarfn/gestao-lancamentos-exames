import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditoriaService } from './auditoria.service';
import { QueryAuditoriaDto } from './dto/query-auditoria.dto';

/** Consulta da trilha de auditoria — restrita ao papel ADMIN (visão completa de responsabilização). */
@ApiBearerAuth()
@ApiTags('Auditoria')
@Roles('ADMIN')
@Controller({ path: 'auditoria', version: '1' })
export class AuditoriaController {
  constructor(private readonly service: AuditoriaService) {}

  @Get()
  listar(@Query() query: QueryAuditoriaDto) {
    return this.service.listar(query);
  }

  @Get('entidades')
  listarEntidades() {
    return this.service.listarEntidades();
  }
}
