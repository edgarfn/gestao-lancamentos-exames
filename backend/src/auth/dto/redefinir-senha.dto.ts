import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RedefinirSenhaDto {
  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Token obrigatório.' })
  token!: string;

  @ApiProperty({ example: 'NovaSenhaForte123!' })
  @IsString()
  @MinLength(8, { message: 'A nova senha deve ter ao menos 8 caracteres.' })
  novaSenha!: string;
}
