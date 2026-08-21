import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { AvailabilityService } from './availability.service';
import { UpsertAvailabilityDto } from './dto/upsert-availability.dto';
import { GetAvailabilityQueryDto } from './dto/get-availability-query.dto';

@Controller('availability')
@UseGuards(JwtAuthGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Put()
  upsert(@CurrentUser() user: AccessTokenPayload, @Body() dto: UpsertAvailabilityDto) {
    return this.availabilityService.upsertBulk(user.sub, dto);
  }

  @Get()
  findEffective(
    @CurrentUser() user: AccessTokenPayload,
    @Query() query: GetAvailabilityQueryDto,
  ) {
    return this.availabilityService.getEffectiveAvailability(
      user.sub,
      query.employeeId,
      query.weekStart,
    );
  }
}
