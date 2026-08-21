import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const EMAIL = process.env.SEED_MANAGER_EMAIL ?? 'manager@example.com';
const PASSWORD = process.env.SEED_MANAGER_PASSWORD ?? 'ChangeMe123!';
const OTHER_MANAGER_EMAIL = 'other-manager.employee.e2e@example.com';
const OTHER_MANAGER_PASSWORD = 'OtherManager123!';

describe('Employee (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerToken: string;
  let otherToken: string;
  let branchId: string;
  let employeeId: string;
  let otherManagerId: string;
  let templateId: string;
  const WEEK_START = '2026-03-02';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const owner = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });

    const otherManager = await prisma.user.create({
      data: {
        organizationId: owner.organizationId,
        fullName: 'Other Employee E2E Manager',
        email: OTHER_MANAGER_EMAIL,
        passwordHash: await bcrypt.hash(OTHER_MANAGER_PASSWORD, 10),
      },
    });
    otherManagerId = otherManager.id;

    const ownerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
    ownerToken = ownerLogin.body.accessToken;

    const otherLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: OTHER_MANAGER_EMAIL, password: OTHER_MANAGER_PASSWORD })
      .expect(200);
    otherToken = otherLogin.body.accessToken;

    const branch = await request(app.getHttpServer())
      .post('/branches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Besiktas', timezone: 'Europe/Istanbul' })
      .expect(201);
    branchId = branch.body.id;
  });

  afterAll(async () => {
    if (branchId) {
      await prisma.shiftAssignment.deleteMany({ where: { branchId } });
    }
    if (employeeId) {
      await prisma.employee.delete({ where: { id: employeeId } }).catch(() => undefined);
    }
    if (templateId) {
      await prisma.shiftTemplate.delete({ where: { id: templateId } }).catch(() => undefined);
    }
    if (branchId) {
      await prisma.branch.delete({ where: { id: branchId } }).catch(() => undefined);
    }
    await prisma.user.delete({ where: { id: otherManagerId } }).catch(() => undefined);
    await app.close();
  });

  it('creates an employee (org-scoped, no branch yet)', async () => {
    const response = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        fullName: 'Ayse Yilmaz',
        employmentType: 'PARTTIME',
        startDate: '2026-01-01',
        canWorkAlone: true,
      })
      .expect(201);

    expect(response.body.fullName).toBe('Ayse Yilmaz');
    employeeId = response.body.id;
  });

  it('lets any manager in the org edit an employee with no branch yet', () => {
    return request(app.getHttpServer())
      .patch(`/employees/${employeeId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ phone: '5551234567' })
      .expect(200);
  });

  it('forbids assigning a branch you do not manage', () => {
    return request(app.getHttpServer())
      .post(`/employees/${employeeId}/branches`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ branchId, action: 'ADD' })
      .expect(403);
  });

  it('assigns the employee to a branch', async () => {
    const response = await request(app.getHttpServer())
      .post(`/employees/${employeeId}/branches`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ branchId, action: 'ADD', isHomeBranch: true })
      .expect(201);

    expect(
      response.body.branches.some((b: { branchId: string }) => b.branchId === branchId),
    ).toBe(true);

    const list = await request(app.getHttpServer())
      .get(`/employees?branchId=${branchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(list.body.map((e: { id: string }) => e.id)).toContain(employeeId);
  });

  it('now forbids the unassigned manager from editing the employee', () => {
    return request(app.getHttpServer())
      .patch(`/employees/${employeeId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ phone: '5559999999' })
      .expect(403);
  });

  it('reports actual vs target shifts for a week when weekStart is provided', async () => {
    await request(app.getHttpServer())
      .patch(`/employees/${employeeId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ targetShiftsPerWeek: 3 })
      .expect(200);

    const template = await request(app.getHttpServer())
      .post(`/branches/${branchId}/shift-templates`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Sabah', startTime: '08:00', endTime: '16:00', requiredStaffCount: 1 })
      .expect(201);
    templateId = template.body.id;

    const schedule = await request(app.getHttpServer())
      .get(`/schedule?branchId=${branchId}&weekStart=${WEEK_START}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const mondaySlot = schedule.body.find((a: { dayOfWeek: string }) => a.dayOfWeek === 'MONDAY');

    await request(app.getHttpServer())
      .patch(`/schedule/assignments/${mondaySlot.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ employeeId })
      .expect(200);

    const withoutWeek = await request(app.getHttpServer())
      .get(`/employees?branchId=${branchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const employeeWithoutWeek = withoutWeek.body.find((e: { id: string }) => e.id === employeeId);
    expect(employeeWithoutWeek.actualShiftsThisWeek).toBeUndefined();

    const withWeek = await request(app.getHttpServer())
      .get(`/employees?branchId=${branchId}&weekStart=${WEEK_START}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const employeeWithWeek = withWeek.body.find((e: { id: string }) => e.id === employeeId);
    expect(employeeWithWeek.targetShiftsPerWeek).toBe(3);
    expect(employeeWithWeek.actualShiftsThisWeek).toBe(1);
  });

  it('requires a branchId query param to list employees', () => {
    return request(app.getHttpServer())
      .get('/employees')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(400);
  });
});
