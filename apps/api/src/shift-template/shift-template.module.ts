import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BranchModule } from '../branch/branch.module';
import { ShiftTemplateController } from './shift-template.controller';
import { ShiftTemplateService } from './shift-template.service';

@Module({
  imports: [AuthModule, BranchModule],
  controllers: [ShiftTemplateController],
  providers: [ShiftTemplateService],
})
export class ShiftTemplateModule {}
