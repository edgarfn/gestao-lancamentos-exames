import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePacienteDto } from './create-paciente.dto';

/** Documento e data de nascimento são imutáveis após o cadastro (identificadores estáveis). */
export class UpdatePacienteDto extends PartialType(
  OmitType(CreatePacienteDto, ['documento', 'dataNascimento'] as const),
) {}
