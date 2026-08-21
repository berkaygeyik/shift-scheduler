import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class GetAvailabilityQueryDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsDateString()
  weekStart: string;
}
