import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

export class GetScheduleQueryDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsDateString()
  weekStart: string;
}
