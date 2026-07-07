import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateConfiguracaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  nomeClinica?: string;

  @IsOptional()
  @IsString()
  @MaxLength(18)
  cnpj?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  endereco?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string;

  @IsOptional()
  @IsEmail()
  emailContato?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  mensagemBemVindo?: string;
}
