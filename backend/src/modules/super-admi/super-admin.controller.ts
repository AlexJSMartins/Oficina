import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { SuperAdminService } from './super-admin.service';
import { JwtAuthGuard } from '../auth/permissions.guard';
import { SuperAdminGuard } from './super-admin.guard';

@Controller('sys-auth')
export class SysAuthController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Post('login')
  login(@Body() body: { email: string; password: string }, @Request() req: any) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';
    return this.superAdminService.loginSuperAdmin(body.email, body.password, ip);
  }
}

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('super-admin')
export class SuperAdminController {
  constructor(private readonly superAdminService: SuperAdminService) {}

  @Get('me')
  getMe(@Request() req: any) {
    return {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    };
  }

  @Get('overview')
  getOverview() {
    return this.superAdminService.getOverview();
  }

  // Planos & Preços
  @Get('plans')
  listPlans() {
    return this.superAdminService.listAllPlans();
  }

  @Post('plans')
  createPlan(@Body() body: any) {
    return this.superAdminService.createPlan(body);
  }

  @Patch('plans/:id')
  updatePlan(@Param('id') id: string, @Body() body: any) {
    return this.superAdminService.updatePlan(id, body);
  }

  @Delete('plans/:id')
  deletePlan(@Param('id') id: string) {
    return this.superAdminService.deletePlan(id);
  }

  // Oficinas & Leads
  @Get('workshops')
  listWorkshops(@Query('search') search?: string, @Query('status') status?: string) {
    return this.superAdminService.listWorkshops({ search, status });
  }

  @Post('workshops/:workshopId/extend-trial')
  extendTrial(@Param('workshopId') workshopId: string, @Body() body: { days: number }) {
    return this.superAdminService.extendTrial(workshopId, body.days);
  }

  @Patch('workshops/:workshopId/subscription')
  updateSubscription(@Param('workshopId') workshopId: string, @Body() body: any) {
    return this.superAdminService.updateWorkshopSubscription(workshopId, body);
  }

  // Faturas / Pagamentos Asaas
  @Get('payments')
  listPayments(@Query('status') status?: string) {
    return this.superAdminService.listPayments(status);
  }
}