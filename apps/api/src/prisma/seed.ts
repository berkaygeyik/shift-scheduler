import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const email = process.env.SEED_MANAGER_EMAIL ?? 'manager@example.com';
  const password = process.env.SEED_MANAGER_PASSWORD ?? 'ChangeMe123!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists, skipping seed.`);
    await prisma.$disconnect();
    return;
  }

  const organization = await prisma.organization.create({
    data: { name: 'Demo Organization' },
  });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      fullName: 'Demo Manager',
      email,
      passwordHash,
    },
  });

  console.log(`Seeded manager ${user.email} in organization ${organization.name}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
