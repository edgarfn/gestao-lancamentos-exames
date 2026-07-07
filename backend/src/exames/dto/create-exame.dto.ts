import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumberString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateExameDto {
  @ApiProperty({ example: 'Hemograma Completo' })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  nome!: string;

  @ApiProperty({ example: 'HEMO001' })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  codigo!: string;

  @ApiProperty({ example: '45.00', description: 'Valor padrão cobrado pelo exame.' })
  @IsNumberString({ no_symbols: false }, { message: 'Valor padrão deve ser numérico (ex.: 45.00).' })
  valorPadrao!: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @ApiProperty({ description: 'ID da especialidade vinculada ao exame.' })
  @IsString()
  @IsNotEmpty({ message: 'Selecione a especialidade do exame.' })
  especialidadeId!: string;
}
