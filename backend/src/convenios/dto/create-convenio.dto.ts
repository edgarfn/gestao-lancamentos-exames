import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateConvenioDto {
  @ApiProperty({ example: 'Unimed' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  nome!: string;

  @ApiPropertyOptional({ example: 'Plano de saúde cooperativo.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
