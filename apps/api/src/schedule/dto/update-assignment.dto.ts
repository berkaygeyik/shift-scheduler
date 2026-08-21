import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateAssignmentDto {
  @IsString()
  @IsOptional()
  employeeId?: string;

  @IsBoolean()
  @IsOptional()
  locked?: boolean;
}
