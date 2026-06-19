import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/authenticated-user.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard.js';
import { DashboardService } from './dashboard.service.js';

@Controller('internal/inventory/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(
    @CurrentUser()
    user: AuthenticatedUser,
  ) {
    return this.dashboardService.getSummary(user.sub);
  }
}
