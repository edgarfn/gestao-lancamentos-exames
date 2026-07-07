import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateExameDto } from './create-exame.dto';

/** O código do exame é um identificador estável e não pode ser alterado. */
export class UpdateExameDto extends PartialType(OmitType(CreateExameDto, ['codigo'] as const)) {}
