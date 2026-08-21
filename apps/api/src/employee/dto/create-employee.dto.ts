import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { EmploymentType } from '../../generated/prisma/enums';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @IsDateString()
  startDate: string;

  @IsBoolean()
  @IsOptional()
  canWorkAlone?: boolean;

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  experienceScore?: number;

  @IsBoolean()
  @IsOptional()
  isKeyHolder?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  targetShiftsPerWeek?: number;

  @IsBoolean()
  @IsOptional()
  isDefaultRosterMember?: boolean;

  @IsIn(['active', 'inactive'])
  @IsOptional()
  status?: string;
}
