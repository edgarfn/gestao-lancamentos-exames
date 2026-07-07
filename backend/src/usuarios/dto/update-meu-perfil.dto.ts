import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Campos que o próprio usuário pode alterar em seu cadastro — papel e status são exclusivos do ADMIN. */
export class UpdateMeuPerfilDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  nome?: string;
}
