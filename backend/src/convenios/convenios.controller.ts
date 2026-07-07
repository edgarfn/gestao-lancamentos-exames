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
import { ConveniosService } from './convenios.service';
import { CreateConvenioDto } from './dto/create-convenio.dto';
import { UpdateConvenioDto } from './dto/update-convenio.dto';
import { QueryConvenioDto } from './dto/query-convenio.dto';

@ApiBearerAuth()
@ApiTags('Convênios')
@Controller({ path: 'convenios', version: '1' })
export class ConveniosController {
  constructor(private readonly service: ConveniosService) {}

  @Roles('ADMIN', 'GESTOR')
  @Post()
  criar(@Body() dto: CreateConvenioDto, @Req() req: Request) {
    return this.service.criar(dto, extractAuditContext(req));
  }

  @Get()
  listar(@Query() query: QueryConvenioDto) {
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
  atualizar(@Param('id') id: string, @Body() dto: UpdateConvenioDto, @Req() req: Request) {
    return this.service.atualizar(id, dto, extractAuditContext(req));
  }

  @Roles('ADMIN', 'GESTOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remover(@Param('id') id: string, @Req() req: Request): Promise<void> {
    await this.service.remover(id, extractAuditContext(req));
  }
}
