import { IsDateString, IsIn, IsNotEmpty, IsString } from 'class-validator';

export class AutoFillDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;

  @IsDateString()
  weekStart: string;

  @IsIn(['fill_empty', 'randomize_all'])
  mode: 'fill_empty' | 'randomize_all';
}
