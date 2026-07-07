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
import { ExamesService } from './exames.service';
import { CreateExameDto } from './dto/create-exame.dto';
import { UpdateExameDto } from './dto/update-exame.dto';
import { QueryExameDto } from './dto/query-exame.dto';

@ApiBearerAuth()
@ApiTags('Exames')
@Controller({ path: 'exames', version: '1' })
export class ExamesController {
  constructor(private readonly service: ExamesService) {}

  @Roles('ADMIN', 'GESTOR')
  @Post()
  criar(@Body() dto: CreateExameDto, @Req() req: Request) {
    return this.service.criar(dto, extractAuditContext(req));
  }

  @Get()
  listar(@Query() query: QueryExameDto) {
    return this.service.listar(query);
  }

  @Get(':id')
  buscar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.buscarPorId(id);
  }

  @Roles('ADMIN', 'GESTOR')
  @Patch(':id')
  atualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateExameDto, @Req() req: Request) {
    return this.service.atualizar(id, dto, extractAuditContext(req));
  }

  @Roles('ADMIN', 'GESTOR')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':id')
  async remover(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request): Promise<void> {
    await this.service.remover(id, extractAuditContext(req));
  }
}
