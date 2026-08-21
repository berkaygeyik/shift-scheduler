import { IsNotEmpty, IsString } from 'class-validator';

export class ListEmployeesDto {
  @IsString()
  @IsNotEmpty()
  branchId: string;
}
