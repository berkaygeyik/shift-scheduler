import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { ScheduleService } from './schedule.service';
import { GetScheduleQueryDto } from './dto/get-schedule-query.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { AutoFillDto } from './dto/auto-fill.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get('schedule')
  findSchedule(@CurrentUser() user: AccessTokenPayload, @Query() query: GetScheduleQueryDto) {
    return this.scheduleService.findSchedule(user.sub, query.branchId, query.weekStart);
  }

  @Post('schedule/auto-fill')
  autoFill(@CurrentUser() user: AccessTokenPayload, @Body() dto: AutoFillDto) {
    return this.scheduleService.autoFill(user.sub, dto);
  }

  @Patch('schedule/assignments/:id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.scheduleService.updateAssignment(user.sub, id, dto);
  }

  @Delete('schedule/assignments/:id')
  clear(@CurrentUser() user: AccessTokenPayload, @Param('id') id: string) {
    return this.scheduleService.clearAssignment(user.sub, id);
  }
}
