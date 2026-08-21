import {
  IsBoolean,
  IsInt,
  IsMilitaryTime,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateShiftTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsMilitaryTime()
  startTime: string;

  @IsMilitaryTime()
  endTime: string;

  @IsInt()
  @Min(1)
  requiredStaffCount: number;

  @IsBoolean()
  @IsOptional()
  requiresKeyHolder?: boolean;

  @IsBoolean()
  @IsOptional()
  isOpening?: boolean;

  @IsBoolean()
  @IsOptional()
  isClosing?: boolean;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}
