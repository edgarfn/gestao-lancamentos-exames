import { ApiPropertyOptional } from '@nestjs/swagger';
import { Papel } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUsuarioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  nome?: string;

  @ApiPropertyOptional({ enum: Papel })
  @IsOptional()
  @IsEnum(Papel)
  papel?: Papel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  registroProfissional?: string;
}
