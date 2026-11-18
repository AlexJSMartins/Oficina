import { Controller, Post, Get, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard, PermissionsGuard, RequirePermissions } from './permissions.guard';
import { PERMISSIONS } from './permissions.constants';
import { Role } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Nova rota pública para Leads criarem sua Oficina + Acesso Admin isolado
  @Post('register')
  register(
    @Body()
    body: {
      workshopName: string;
      document?: string;
      phone?: string;
      adminName: string;
      email: string;
      password: string;
    },
  ) {
    return this.authService.registerWorkshopLead(body);
  }

  @Post('login')
  login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req: any) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Get('users')
  listUsers(@Request() req: any) {
    return this.authService.listUsers(req.user.workshopId);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Post('users')
  createUser(
    @Request() req: any,
    @Body()
    body: {
      name: string;
      email: string;
      password: string;
      role: Role;
      permissions: string[];
      commissionRate?: number;
    },
  ) {
    return this.authService.createUser(req.user.workshopId, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @Patch('users/:id')
  updateUser(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { role?: Role; permissions?: string[]; isActive?: boolean; commissionRate?: number },
  ) {
    return this.authService.updateUserPermissions(req.user.workshopId, id, body);
  }
}