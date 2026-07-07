import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Papel } from '@prisma/client';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/;

export class CreateUsuarioDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  nome!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: Papel })
  @IsEnum(Papel, { message: 'Papel deve ser ADMIN, GESTOR ou TECNICO.' })
  papel!: Papel;

  @ApiProperty({ description: 'Mínimo 12 caracteres, com maiúscula, minúscula, número e símbolo.' })
  @IsString()
  @MinLength(12, { message: 'A senha deve ter ao menos 12 caracteres.' })
  @Matches(STRONG_PASSWORD_REGEX, {
    message: 'A senha deve conter maiúscula, minúscula, número e símbolo.',
  })
  senha!: string;
}
