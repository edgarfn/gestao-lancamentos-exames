import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateLancamentoDto {
  @ApiProperty({ description: 'ID do técnico responsável.' })
  @IsUUID()
  tecnicoId!: string;

  @ApiProperty({ description: 'ID do paciente atendido.' })
  @IsUUID()
  pacienteId!: string;

  @ApiProperty({ description: 'ID do exame realizado (catálogo).' })
  @IsUUID()
  exameId!: string;

  @ApiProperty({ example: '2026-06-07', description: 'Data em que o exame foi realizado.' })
  @IsDateString({}, { message: 'Data deve estar no formato AAAA-MM-DD.' })
  data!: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 1000 })
  @IsInt()
  @Min(1, { message: 'Quantidade deve ser maior que zero.' })
  @Max(1000, { message: 'Quantidade acima do limite permitido — verifique o lançamento.' })
  quantidade!: number;

  @ApiProperty({ example: '45.00', description: 'Valor total cobrado pelo lançamento.' })
  @IsNumberString({ no_symbols: false }, { message: 'Valor deve ser numérico (ex.: 45.00).' })
  valor!: string;

  @ApiProperty({ required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  observacoes?: string;

  @ApiProperty({ required: false, description: 'ID do convênio vinculado ao lançamento.' })
  @IsOptional()
  @IsUUID()
  convenioId?: string;
}
