import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('123456', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@oficina.com' },
    update: {},
    create: {
      name: 'Administrador da Oficina',
      email: 'admin@oficina.com',
      passwordHash,
      role: Role.ADMIN,
      permissions: [
        'customers:manage',
        'orders:checkin',
        'orders:diagnosis',
        'orders:view_all',
        'budgets:manage',
        'financial:cashflow',
        'financial:dre',
        'users:manage',
      ],
    },
  });

  console.log('Admin criado com sucesso:', admin.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
