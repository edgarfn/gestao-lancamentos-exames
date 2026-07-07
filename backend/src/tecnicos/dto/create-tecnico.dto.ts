import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { IsCpf } from '../../common/validators/is-cpf.validator';

export class CreateTecnicoDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  nome!: string;

  @ApiProperty({ description: 'CPF (apenas dígitos ou formatado).', example: '123.456.789-09', required: false })
  @IsOptional()
  @IsString()
  @IsCpf()
  documento?: string;

  @ApiProperty({ example: 'COREN-SP 123456', required: false })
  @IsOptional()
  @IsString()
  @Length(3, 50)
  registroProfissional?: string;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
