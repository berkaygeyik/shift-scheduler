import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/auth.service';
import { ShiftTemplateService } from './shift-template.service';
import { CreateShiftTemplateDto } from './dto/create-shift-template.dto';
import { UpdateShiftTemplateDto } from './dto/update-shift-template.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class ShiftTemplateController {
  constructor(private readonly shiftTemplateService: ShiftTemplateService) {}

  @Post('branches/:branchId/shift-templates')
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Param('branchId') branchId: string,
    @Body() dto: CreateShiftTemplateDto,
  ) {
    return this.shiftTemplateService.create(user.sub, branchId, dto);
  }

  @Get('branches/:branchId/shift-templates')
  findAll(
    @CurrentUser() user: AccessTokenPayload,
    @Param('branchId') branchId: string,
  ) {
    return this.shiftTemplateService.findAllForBranch(user.sub, branchId);
  }

  @Patch('shift-templates/:id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() dto: UpdateShiftTemplateDto,
  ) {
    return this.shiftTemplateService.update(user.sub, id, dto);
  }
}
