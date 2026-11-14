// backend/src/modules/auth/auth.service.ts

import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const payload = { sub: user.id, email: user.email, role: user.role, permissions: user.permissions };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
      },
    };
  }

  async listUsers() {
    return this.prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, permissions: true, isActive: true, createdAt: true, commissionRate: true },
      orderBy: { name: 'asc' },
    });
  }

  async createUser(data: { name: string; email: string; password: string; role: Role; permissions: string[]; commissionRate?: number }) {
    const exists = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (exists) throw new ConflictException('E-mail já cadastrado.');

    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role,
        permissions: data.permissions,
        commissionRate: data.commissionRate,
      },
      select: { id: true, name: true, email: true, role: true, permissions: true, isActive: true, commissionRate: true },
    });
  }

 async updateUserPermissions(userId: string, data: { role?: Role; permissions?: string[]; isActive?: boolean; commissionRate?: number }) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        role: data.role,
        permissions: data.permissions,
        isActive: data.isActive,
        commissionRate: data.commissionRate, // Adiciona a atualização da taxa de comissão do mecânico
      },
    });
  }
  
}