import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsCpf } from '../../common/validators/is-cpf.validator';

export class CreatePacienteDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  nome!: string;

  @ApiProperty({
    required: false,
    example: '123.456.789-09',
    description: 'CPF do paciente (opcional, dado sensível).',
  })
  @IsOptional()
  @IsString()
  @IsCpf()
  documento?: string;

  @ApiProperty({ required: false, example: '1990-05-20', description: 'Data de nascimento (opcional).' })
  @IsOptional()
  @IsDateString({}, { message: 'Data de nascimento deve estar no formato AAAA-MM-DD.' })
  dataNascimento?: string;

  @ApiProperty({ required: false, description: 'Telefone ou e-mail de contato (opcional, dado sensível).' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  contato?: string;
}
