import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AvailabilityStatus, DayOfWeek } from '../../generated/prisma/enums';

export class UpsertAvailabilityEntryDto {
  @IsString()
  employeeId: string;

  @IsDateString()
  @IsOptional()
  weekStartDate?: string;

  @IsEnum(DayOfWeek)
  dayOfWeek: DayOfWeek;

  @IsString()
  @IsOptional()
  shiftTemplateId?: string;

  @IsEnum(AvailabilityStatus)
  status: AvailabilityStatus;

  @IsString()
  @IsOptional()
  note?: string;
}

export class UpsertAvailabilityDto {
  @ValidateNested({ each: true })
  @Type(() => UpsertAvailabilityEntryDto)
  @ArrayMinSize(1)
  entries: UpsertAvailabilityEntryDto[];
}
