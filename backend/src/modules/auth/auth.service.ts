import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@prisma/client';

const ALL_ADMIN_PERMISSIONS = [
  'customers:manage',
  'orders:checkin',
  'orders:diagnosis',
  'orders:view_all',
  'budgets:manage',
  'financial:manage',
  'financial:cashflow',
  'financial:dre',
  'inventory:manage',
  'users:manage',
  'settings:manage',
];

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // Cadastro público de novos Leads (Cria a Sala/Oficina + Usuário ADMIN isolado)
  async registerWorkshopLead(data: {
    workshopName: string;
    document?: string;
    phone?: string;
    adminName: string;
    email: string;
    password: string;
  }) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (existingUser) {
      throw new ConflictException('Este e-mail já está em uso por outra conta.');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    // Transação atômica: cria a Oficina (Tenant) e o Usuário Admin vinculado a ela
    const { workshop, user } = await this.prisma.$transaction(async (tx) => {
      const createdWorkshop = await tx.workshopSettings.create({
        data: {
          name: data.workshopName.trim(),
          document: data.document?.trim() || null,
          phone: data.phone?.trim() || null,
        },
      });

      const createdUser = await tx.user.create({
        data: {
          workshopId: createdWorkshop.id,
          name: data.adminName.trim(),
          email: data.email.toLowerCase().trim(),
          passwordHash,
          role: Role.ADMIN,
          permissions: ALL_ADMIN_PERMISSIONS,
          isActive: true,
        },
      });

      return { workshop: createdWorkshop, user: createdUser };
    });

    const payload = {
      sub: user.id,
      workshopId: workshop.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        workshopId: workshop.id,
        workshopName: workshop.name,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        commissionRate: user.commissionRate,
      },
    };
  }

  async login(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { workshop: { select: { id: true, name: true } } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const isMatch = await bcrypt.compare(pass, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const payload = {
      sub: user.id,
      workshopId: user.workshopId,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        workshopId: user.workshopId,
        workshopName: user.workshop?.name,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        commissionRate: user.commissionRate,
      },
    };
  }

  // Lista APENAS os funcionários da mesma oficina do Admin logado
  async listUsers(workshopId: string) {
    return this.prisma.user.findMany({
      where: { workshopId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        commissionRate: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  // Cria funcionário dentro da mesma sala (workshopId) do Admin logado
  async createUser(
    workshopId: string,
    data: {
      name: string;
      email: string;
      password: string;
      role: Role;
      permissions: string[];
      commissionRate?: number;
    },
  ) {
    const exists = await this.prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });
    if (exists) throw new ConflictException('E-mail já cadastrado.');

    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        workshopId,
        name: data.name,
        email: data.email.toLowerCase().trim(),
        passwordHash,
        role: data.role,
        permissions: data.permissions,
        commissionRate: data.commissionRate ?? 0,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        commissionRate: true,
        isActive: true,
      },
    });
  }

  // Atualiza apenas se o funcionário pertencer à mesma oficina do Admin logado
  async updateUserPermissions(
    workshopId: string,
    id: string,
    data: { role?: Role; permissions?: string[]; isActive?: boolean; commissionRate?: number },
  ) {
    return this.prisma.user.update({
      where: { id, workshopId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        commissionRate: true,
        isActive: true,
      },
    });
  }
}