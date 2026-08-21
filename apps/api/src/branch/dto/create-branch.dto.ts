import { IsNotEmpty, IsString, IsTimeZone } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsTimeZone()
  timezone: string;
}
