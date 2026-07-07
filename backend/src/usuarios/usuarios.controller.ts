import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { extractAuditContext } from '../common/decorators/request-context';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UpdateMeuPerfilDto } from './dto/update-meu-perfil.dto';

/**
 * Gestão de contas de acesso ao sistema. As rotas de listagem/cadastro/edição de
 * terceiros são restritas aos papéis ADMIN e GESTOR; as rotas "me" abaixo
 * usam @Roles() sem argumentos para liberar o autoatendimento a qualquer pessoa
 * autenticada, permitindo consultar e atualizar apenas o próprio cadastro.
 */
@ApiBearerAuth()
@ApiTags('Usuários')
@Roles('ADMIN', 'GESTOR')
@Controller({ path: 'usuarios', version: '1' })
export class UsuariosController {
  constructor(private readonly service: UsuariosService) {}

  @Roles()
  @Get('me')
  buscarPerfilProprio(@CurrentUser() user: AuthenticatedUser) {
    return this.service.buscarPorId(user.id);
  }

  @Roles()
  @Patch('me')
  atualizarPerfilProprio(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateMeuPerfilDto,
    @Req() req: Request,
  ) {
    return this.service.atualizar(user.id, dto, extractAuditContext(req));
  }

  @Post()
  criar(@Body() dto: CreateUsuarioDto, @Req() req: Request) {
    return this.service.criar(dto, extractAuditContext(req));
  }

  @Get()
  listar(@Req() req: Request) {
    return this.service.listar(extractAuditContext(req));
  }

  @Get(':id')
  buscar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.buscarPorId(id);
  }

  @Patch(':id')
  atualizar(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUsuarioDto, @Req() req: Request) {
    return this.service.atualizar(id, dto, extractAuditContext(req));
  }

  @Post(':id/redefinir-senha')
  redefinirSenha(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.service.redefinirSenha(id, extractAuditContext(req));
  }
}
