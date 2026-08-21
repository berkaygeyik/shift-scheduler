import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class AssignBranchDto {
  @IsString()
  branchId: string;

  @IsIn(['ADD', 'REMOVE'])
  action: 'ADD' | 'REMOVE';

  @IsBoolean()
  @IsOptional()
  isHomeBranch?: boolean;
}
