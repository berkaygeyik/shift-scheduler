import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BranchModule } from './branch/branch.module';
import { ShiftTemplateModule } from './shift-template/shift-template.module';
import { EmployeeModule } from './employee/employee.module';
import { AvailabilityModule } from './availability/availability.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    BranchModule,
    ShiftTemplateModule,
    EmployeeModule,
    AvailabilityModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
