import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import type { EmploymentType } from '../generated/prisma/enums';

const BRANCH_NAME = 'Barer';
const EMPTY_BRANCH_NAME = 'Leopold';

interface EmployeeSeed {
  fullName: string;
  employmentType: EmploymentType;
  targetShiftsPerWeek: number;
  experienceScore: number;
  canWorkAlone: boolean;
  isKeyHolder: boolean;
  startDate: string;
}

const EMPLOYEES: EmployeeSeed[] = [
  {
    fullName: 'Lukas Bauer',
    employmentType: 'FULLTIME',
    targetShiftsPerWeek: 5,
    experienceScore: 9,
    canWorkAlone: true,
    isKeyHolder: true,
    startDate: '2023-03-01',
  },
  {
    fullName: 'Anna Hoffmann',
    employmentType: 'FULLTIME',
    targetShiftsPerWeek: 5,
    experienceScore: 7,
    canWorkAlone: true,
    isKeyHolder: false,
    startDate: '2024-01-15',
  },
  {
    fullName: 'Felix Wagner',
    employmentType: 'FULLTIME',
    targetShiftsPerWeek: 5,
    experienceScore: 6,
    canWorkAlone: true,
    isKeyHolder: false,
    startDate: '2024-06-01',
  },
  {
    fullName: 'Mia Schmidt',
    employmentType: 'PARTTIME',
    targetShiftsPerWeek: 3,
    experienceScore: 5,
    canWorkAlone: false,
    isKeyHolder: false,
    startDate: '2025-01-10',
  },
  {
    fullName: 'Jonas Weber',
    employmentType: 'PARTTIME',
    targetShiftsPerWeek: 3,
    experienceScore: 4,
    canWorkAlone: false,
    isKeyHolder: false,
    startDate: '2025-02-01',
  },
  {
    fullName: 'Sophie Fischer',
    employmentType: 'PARTTIME',
    targetShiftsPerWeek: 3,
    experienceScore: 5,
    canWorkAlone: false,
    isKeyHolder: false,
    startDate: '2025-03-15',
  },
  {
    fullName: 'Paul Richter',
    employmentType: 'PARTTIME',
    targetShiftsPerWeek: 3,
    experienceScore: 3,
    canWorkAlone: false,
    isKeyHolder: false,
    startDate: '2025-04-01',
  },
  {
    fullName: 'Emma Koch',
    employmentType: 'MINIJOB',
    targetShiftsPerWeek: 1,
    experienceScore: 2,
    canWorkAlone: false,
    isKeyHolder: false,
    startDate: '2025-08-01',
  },
  {
    fullName: 'Noah Klein',
    employmentType: 'MINIJOB',
    targetShiftsPerWeek: 1,
    experienceScore: 2,
    canWorkAlone: false,
    isKeyHolder: false,
    startDate: '2025-09-01',
  },
];

async function seedManager(prisma: PrismaClient) {
  const email = process.env.SEED_MANAGER_EMAIL ?? 'manager@example.com';
  const password = process.env.SEED_MANAGER_PASSWORD ?? 'ChangeMe123!';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`User ${email} already exists, skipping manager seed.`);
    return existing;
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
  return user;
}

async function seedBarer(prisma: PrismaClient, organizationId: string, managerId: string) {
  const existing = await prisma.branch.findFirst({
    where: { organizationId, name: BRANCH_NAME },
  });
  if (existing) {
    console.log(`Branch ${BRANCH_NAME} already exists, skipping.`);
    return;
  }

  const branch = await prisma.branch.create({
    data: {
      organizationId,
      name: BRANCH_NAME,
      timezone: 'Europe/Berlin',
      managers: { create: { userId: managerId } },
    },
  });

  await prisma.shiftTemplate.createMany({
    data: [
      {
        branchId: branch.id,
        name: 'Morning',
        startTime: '07:00',
        endTime: '14:30',
        requiredStaffCount: 2,
        isOpening: true,
      },
      {
        branchId: branch.id,
        name: 'Evening',
        startTime: '14:30',
        endTime: '22:00',
        requiredStaffCount: 2,
        isClosing: true,
      },
    ],
  });

  for (const employeeSeed of EMPLOYEES) {
    const employee = await prisma.employee.create({
      data: {
        organizationId,
        fullName: employeeSeed.fullName,
        employmentType: employeeSeed.employmentType,
        startDate: new Date(employeeSeed.startDate),
        canWorkAlone: employeeSeed.canWorkAlone,
        experienceScore: employeeSeed.experienceScore,
        isKeyHolder: employeeSeed.isKeyHolder,
        targetShiftsPerWeek: employeeSeed.targetShiftsPerWeek,
      },
    });
    await prisma.employeeBranch.create({
      data: { employeeId: employee.id, branchId: branch.id, isHomeBranch: true },
    });
  }

  console.log(
    `Seeded branch ${BRANCH_NAME} with 2 shift templates and ${EMPLOYEES.length} employees.`,
  );
}

async function seedEmptyBranch(prisma: PrismaClient, organizationId: string, managerId: string) {
  const existing = await prisma.branch.findFirst({
    where: { organizationId, name: EMPTY_BRANCH_NAME },
  });
  if (existing) {
    console.log(`Branch ${EMPTY_BRANCH_NAME} already exists, skipping.`);
    return;
  }

  await prisma.branch.create({
    data: {
      organizationId,
      name: EMPTY_BRANCH_NAME,
      timezone: 'Europe/Berlin',
      managers: { create: { userId: managerId } },
    },
  });

  console.log(`Seeded empty branch ${EMPTY_BRANCH_NAME}.`);
}

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const manager = await seedManager(prisma);
  await seedBarer(prisma, manager.organizationId, manager.id);
  await seedEmptyBranch(prisma, manager.organizationId, manager.id);

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
