import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'usuario@exemplo.com' })
  @IsEmail({}, { message: 'Informe um e-mail válido.' })
  email!: string;

  @ApiProperty({ example: 'SenhaForte123!' })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter ao menos 8 caracteres.' })
  senha!: string;

  @ApiProperty({
    description:
      'Token emitido pelo desafio Cloudflare Turnstile (proteção anti-bot) renderizado no formulário de login.',
  })
  @IsString()
  @IsNotEmpty({ message: 'Conclua a verificação de segurança para continuar.' })
  turnstileToken!: string;
}
