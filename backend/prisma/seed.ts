import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1. Cria a primeira Oficina (Tenant)
  const workshop = await prisma.workshopSettings.create({
    data: {
      name: 'Oficina Pro (Matriz)',
      document: '00.000.000/0001-00',
      phone: '(11) 99999-9999',
    },
  });

  // 2. Cria o usuário Admin já amarrado a essa Oficina
  const passwordHash = await bcrypt.hash('123456', 10);

  const admin = await prisma.user.create({
    data: {
      workshopId: workshop.id, // <-- Vinculando o usuário à sala correta!
      name: 'Administrador da Oficina',
      email: 'admin@oficina.com',
      passwordHash,
      role: Role.ADMIN,
      isActive: true,
      permissions: [
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
      ],
    },
  });

  console.log(`✅ Oficina criada: ${workshop.name}`);
  console.log(`✅ Admin criado com sucesso: ${admin.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });