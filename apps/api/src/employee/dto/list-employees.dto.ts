import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ListEmployeesDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsDateString()
  @IsOptional()
  weekStart?: string;
}
