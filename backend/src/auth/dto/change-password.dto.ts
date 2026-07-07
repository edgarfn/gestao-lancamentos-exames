import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  senhaAtual!: string;

  @ApiProperty({ description: 'Mínimo 12 caracteres, com maiúscula, minúscula, número e símbolo.' })
  @IsString()
  @MinLength(12, { message: 'A nova senha deve ter ao menos 12 caracteres.' })
  @Matches(STRONG_PASSWORD_REGEX, {
    message: 'A nova senha deve conter maiúscula, minúscula, número e símbolo.',
  })
  novaSenha!: string;
}
