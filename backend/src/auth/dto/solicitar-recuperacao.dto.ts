import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class SolicitarRecuperacaoDto {
  @ApiProperty({ example: 'usuario@exemplo.com' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;
}
