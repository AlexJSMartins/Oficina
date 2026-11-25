import 'dotenv/config';
import { PrismaClient, Role, SubscriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const commercialWhats = process.env.COMMERCIAL_WHATSAPP || '5517999999999';

  const initialPlans = [
    {
      slug: 'gestao-essencial',
      name: 'Gestão Essencial',
      subtitle: 'Controle total do pátio, clientes, estoque e lucro sem emissão fiscal.',
      badge: null,
      isPopular: false,
      isActive: true,
      isCustomContact: false,
      sortOrder: 1,
      monthlyPrice: 99,
      annualCashPrice: 990, // Equivale a R$ 82,50/mês (2 meses grátis no PIX/Boleto)
      annualCardPrice: 1128, // 12x de R$ 94,00 no cartão com juros inclusos
      maxInstallments: 12,
      allowFiscalEmission: false,
      maxMonthlyInvoices: 0,
      maxUsers: 5,
      features: [
        'Pátio Kanban completo e Check-in com fotos/vídeos',
        'Portal do Cliente em tempo real via WhatsApp',
        'Orçamentos em PDF com a logo e cores da oficina',
        'CRM de Clientes + Alerta de Revisão (6 meses / 10k km)',
        'Controle de Estoque, Fornecedores e Monitor de Defeitos',
        'Financeiro completo, DRE e Comissões de Mecânicos',
        'Até 5 usuários simultâneos',
      ],
    },
    {
      slug: 'fiscal-100',
      name: 'Profissional 100',
      subtitle: 'Gestão completa + até 100 notas fiscais por mês com devolução em 30s.',
      badge: null,
      isPopular: false,
      isActive: true,
      isCustomContact: false,
      sortOrder: 2,
      monthlyPrice: 189,
      annualCashPrice: 1890, // Equivale a R$ 157,50/mês no PIX/Boleto à vista
      annualCardPrice: 2148, // 12x de R$ 179,00 no cartão com juros inclusos
      maxInstallments: 12,
      allowFiscalEmission: true,
      maxMonthlyInvoices: 100,
      maxUsers: 10,
      features: [
        'Tudo do plano Gestão Essencial incluso',
        'Até 100 notas fiscais/mês (NF-e, NFC-e e NFS-e)',
        'Nota de Devolução automática em 30 segundos',
        'Importação de XML de compra direto para o estoque',
        'Pré-DANFE visual antes de transmitir à SEFAZ',
        'Exportação mensal em .ZIP (XML + PDF) para o Contador',
        'Até 10 usuários simultâneos',
      ],
    },
    {
      slug: 'fiscal-300',
      name: 'Master 300',
      subtitle: 'O favorito de centros automotivos com alto giro de peças e serviços.',
      badge: 'Mais Escolhido',
      isPopular: true,
      isActive: true,
      isCustomContact: false,
      sortOrder: 3,
      monthlyPrice: 299,
      annualCashPrice: 2990, // Equivale a R$ 249,17/mês no PIX/Boleto à vista
      annualCardPrice: 3396, // 12x de R$ 283,00 no cartão com juros inclusos
      maxInstallments: 12,
      allowFiscalEmission: true,
      maxMonthlyInvoices: 300,
      maxUsers: 25,
      features: [
        'Tudo do plano Profissional 100 incluso',
        'Até 300 notas fiscais/mês (NF-e, NFC-e, NFS-e e Devoluções)',
        'Até 25 usuários com permissões granulares por cargo',
        'Configuração assistida do Certificado Digital A1',
        'Suporte prioritário no WhatsApp',
      ],
    },
    {
      slug: 'personalizado',
      name: 'Personalizado',
      subtitle: 'Para grandes centros automotivos ou redes com mais de 300 notas/mês.',
      badge: '+300 Notas',
      isPopular: false,
      isActive: true,
      isCustomContact: true,
      whatsappNumber: commercialWhats,
      whatsappMessage:
        'Olá! Quero montar um plano personalizado acima de 300 notas/mês no Oficina Pro para minha oficina.',
      sortOrder: 4,
      monthlyPrice: 0,
      annualCashPrice: 0,
      annualCardPrice: 0,
      maxInstallments: 12,
      allowFiscalEmission: true,
      maxMonthlyInvoices: 1000,
      maxUsers: 999,
      features: [
        'Volume de notas fiscais sob medida (+300 notas/mês)',
        'Usuários e mecânicos ilimitados',
        'Migração assistida completa de planilhas e estoque',
        'Implantação fiscal dedicada com especialista',
        'Atendimento VIP direto pelo WhatsApp',
      ],
    },
  ];

  for (const plan of initialPlans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    });
  }
  console.log('4 planos iniciais criados/atualizados com sucesso.');

  // Garante assinatura TRIAL de 30 dias para oficinas já existentes sem assinatura
  const workshops = await prisma.workshopSettings.findMany({
    include: { subscription: true },
  });

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 30);

  for (const ws of workshops) {
    if (!ws.subscription) {
      await prisma.subscription.create({
        data: {
          workshopId: ws.id,
          status: SubscriptionStatus.TRIAL,
          trialEndsAt: trialEnd,
        },
      });
    }
  }
  console.log(`Assinaturas verificadas para ${workshops.length} oficina(s).`);

  // Cria ou garante o usuário SUPER_ADMIN para o login secreto /console
  const superEmail = (process.env.SUPER_ADMIN_EMAIL || 'root@oficinapro.com').toLowerCase().trim();
  const superPass = process.env.SUPER_ADMIN_PASSWORD || 'OficinaRoot@2026';

  let systemWorkshop = await prisma.workshopSettings.findFirst({
    orderBy: { createdAt: 'asc' },
  });
  if (!systemWorkshop) {
    systemWorkshop = await prisma.workshopSettings.create({
      data: { name: 'Oficina Pro HQ' },
    });
  }

  const existingSuper = await prisma.user.findUnique({ where: { email: superEmail } });
  if (!existingSuper) {
    const hash = await bcrypt.hash(superPass, 10);
    await prisma.user.create({
      data: {
        workshopId: systemWorkshop.id,
        name: 'Root Super Admin',
        email: superEmail,
        passwordHash: hash,
        role: Role.SUPER_ADMIN,
        permissions: ['*'],
        isActive: true,
      },
    });
    console.log(`SUPER_ADMIN criado: ${superEmail}`);
  } else {
    if (existingSuper.role !== Role.SUPER_ADMIN) {
      await prisma.user.update({
        where: { id: existingSuper.id },
        data: { role: Role.SUPER_ADMIN, isActive: true },
      });
    }
    console.log(`SUPER_ADMIN já existe: ${superEmail}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });