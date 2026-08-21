import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { EmployeeService } from './employee.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { AssignBranchDto } from './dto/assign-branch.dto';
import { ListEmployeesDto } from './dto/list-employees.dto';

@Controller('employees')
@UseGuards(JwtAuthGuard)
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Post()
  create(@CurrentUser() user: AccessTokenPayload, @Body() dto: CreateEmployeeDto) {
    return this.employeeService.create(user.organizationId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AccessTokenPayload, @Query() query: ListEmployeesDto) {
    return this.employeeService.findAllForBranch(user.sub, query.branchId, query.weekStart);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeeService.update(user.sub, id, dto);
  }

  @Post(':id/branches')
  assignBranch(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: AssignBranchDto,
  ) {
    return this.employeeService.assignBranch(user.sub, id, dto);
  }
}
