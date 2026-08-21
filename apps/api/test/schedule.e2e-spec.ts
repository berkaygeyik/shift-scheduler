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
const OTHER_MANAGER_EMAIL = 'other-manager.schedule.e2e@example.com';
const OTHER_MANAGER_PASSWORD = 'OtherManager123!';
const WEEK_START = '2026-03-02';

describe('Schedule (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerToken: string;
  let otherToken: string;
  let branchId: string;
  let templateId: string;
  let availableEmployeeId: string;
  let unavailableEmployeeId: string;
  let otherManagerId: string;

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
        fullName: 'Other Schedule E2E Manager',
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
      .send({ name: 'Bakirkoy', timezone: 'Europe/Istanbul' })
      .expect(201);
    branchId = branch.body.id;

    const template = await request(app.getHttpServer())
      .post(`/branches/${branchId}/shift-templates`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Sabah',
        startTime: '08:00',
        endTime: '16:00',
        requiredStaffCount: 2,
      })
      .expect(201);
    templateId = template.body.id;

    const available = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ fullName: 'Available Emp', employmentType: 'FULLTIME', startDate: '2026-01-01' })
      .expect(201);
    availableEmployeeId = available.body.id;
    await request(app.getHttpServer())
      .post(`/employees/${availableEmployeeId}/branches`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ branchId, action: 'ADD' })
      .expect(201);

    const unavailable = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ fullName: 'Unavailable Emp', employmentType: 'FULLTIME', startDate: '2026-01-01' })
      .expect(201);
    unavailableEmployeeId = unavailable.body.id;
    await request(app.getHttpServer())
      .post(`/employees/${unavailableEmployeeId}/branches`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ branchId, action: 'ADD' })
      .expect(201);

    await request(app.getHttpServer())
      .put('/availability')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        entries: [
          {
            employeeId: unavailableEmployeeId,
            dayOfWeek: 'MONDAY',
            status: 'UNAVAILABLE',
            weekStartDate: WEEK_START,
          },
        ],
      })
      .expect(200);
  });

  afterAll(async () => {
    await prisma.shiftAssignment.deleteMany({ where: { branchId } });
    await prisma.employeeAvailability.deleteMany({
      where: { employeeId: { in: [availableEmployeeId, unavailableEmployeeId] } },
    });
    await prisma.employee.deleteMany({
      where: { id: { in: [availableEmployeeId, unavailableEmployeeId] } },
    });
    await prisma.shiftTemplate.deleteMany({ where: { branchId } });
    if (branchId) {
      await prisma.branch.delete({ where: { id: branchId } }).catch(() => undefined);
    }
    await prisma.user.delete({ where: { id: otherManagerId } }).catch(() => undefined);
    await app.close();
  });

  it('forbids reading the schedule for a branch you do not manage', () => {
    return request(app.getHttpServer())
      .get(`/schedule?branchId=${branchId}&weekStart=${WEEK_START}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
  });

  it('lazily generates the week grid: requiredStaffCount rows per template x 7 days', async () => {
    const response = await request(app.getHttpServer())
      .get(`/schedule?branchId=${branchId}&weekStart=${WEEK_START}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    expect(response.body).toHaveLength(2 * 7);
    expect(response.body.every((a: { employeeId: string | null }) => a.employeeId === null)).toBe(
      true,
    );
  });

  it('manually assigns an employee to a slot', async () => {
    const schedule = await request(app.getHttpServer())
      .get(`/schedule?branchId=${branchId}&weekStart=${WEEK_START}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const mondaySlot = schedule.body.find((a: { dayOfWeek: string }) => a.dayOfWeek === 'MONDAY');

    const patched = await request(app.getHttpServer())
      .patch(`/schedule/assignments/${mondaySlot.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ employeeId: availableEmployeeId, locked: true })
      .expect(200);
    expect(patched.body.employeeId).toBe(availableEmployeeId);
    expect(patched.body.locked).toBe(true);
    expect(patched.body.createdBy).toBe('MANUAL');
  });

  it('rejects assigning an employee who does not belong to the branch', async () => {
    const schedule = await request(app.getHttpServer())
      .get(`/schedule?branchId=${branchId}&weekStart=${WEEK_START}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const tuesdaySlot = schedule.body.find(
      (a: { dayOfWeek: string }) => a.dayOfWeek === 'TUESDAY',
    );

    return request(app.getHttpServer())
      .patch(`/schedule/assignments/${tuesdaySlot.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ employeeId: 'does-not-exist' })
      .expect(400);
  });

  it('clears a slot via DELETE without deleting the row', async () => {
    const schedule = await request(app.getHttpServer())
      .get(`/schedule?branchId=${branchId}&weekStart=${WEEK_START}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    const mondaySlots = schedule.body.filter(
      (a: { dayOfWeek: string; locked: boolean }) => a.dayOfWeek === 'MONDAY' && !a.locked,
    );

    const patched = await request(app.getHttpServer())
      .patch(`/schedule/assignments/${mondaySlots[0].id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ employeeId: unavailableEmployeeId })
      .expect(200);
    expect(patched.body.employeeId).toBe(unavailableEmployeeId);

    const cleared = await request(app.getHttpServer())
      .delete(`/schedule/assignments/${mondaySlots[0].id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(cleared.body.employeeId).toBeNull();
    expect(cleared.body.id).toBe(mondaySlots[0].id);
  });

  it('auto-fills only empty, unlocked slots with available employees', async () => {
    const response = await request(app.getHttpServer())
      .post('/schedule/auto-fill')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ branchId, weekStart: WEEK_START, mode: 'fill_empty' })
      .expect(201);

    const mondaySlots = response.body.filter(
      (a: { dayOfWeek: string }) => a.dayOfWeek === 'MONDAY',
    );
    const lockedSlot = mondaySlots.find((a: { locked: boolean }) => a.locked);
    expect(lockedSlot.employeeId).toBe(availableEmployeeId);

    const autoFilledMonday = mondaySlots.filter((a: { createdBy: string }) => a.createdBy === 'AUTO');
    for (const slot of autoFilledMonday) {
      expect(slot.employeeId).not.toBe(unavailableEmployeeId);
    }

    const stillEmpty = response.body.filter(
      (a: { employeeId: string | null }) => a.employeeId === null,
    );
    expect(stillEmpty).toHaveLength(0);
  });
});
