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
const OTHER_MANAGER_EMAIL = 'other-manager.availability.e2e@example.com';
const OTHER_MANAGER_PASSWORD = 'OtherManager123!';

describe('Availability (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerToken: string;
  let otherToken: string;
  let branchId: string;
  let employeeId: string;
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
        fullName: 'Other Availability E2E Manager',
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
      .send({ name: 'Uskudar', timezone: 'Europe/Istanbul' })
      .expect(201);
    branchId = branch.body.id;

    const employee = await request(app.getHttpServer())
      .post('/employees')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ fullName: 'Mehmet Demir', employmentType: 'FULLTIME', startDate: '2026-01-01' })
      .expect(201);
    employeeId = employee.body.id;

    await request(app.getHttpServer())
      .post(`/employees/${employeeId}/branches`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ branchId, action: 'ADD' })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.employeeAvailability.deleteMany({ where: { employeeId } });
    if (employeeId) {
      await prisma.employee.delete({ where: { id: employeeId } }).catch(() => undefined);
    }
    if (branchId) {
      await prisma.branch.delete({ where: { id: branchId } }).catch(() => undefined);
    }
    await prisma.user.delete({ where: { id: otherManagerId } }).catch(() => undefined);
    await app.close();
  });

  it('forbids entering availability for an employee you cannot access', () => {
    return request(app.getHttpServer())
      .put('/availability')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        entries: [{ employeeId, dayOfWeek: 'MONDAY', status: 'AVAILABLE' }],
      })
      .expect(403);
  });

  it('enters a recurring rule and a week-specific override, and GET returns the merged result', async () => {
    await request(app.getHttpServer())
      .put('/availability')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        entries: [{ employeeId, dayOfWeek: 'MONDAY', status: 'AVAILABLE' }],
      })
      .expect(200);

    const before = await request(app.getHttpServer())
      .get(`/availability?employeeId=${employeeId}&weekStart=2026-03-02`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(before.body).toHaveLength(1);
    expect(before.body[0].status).toBe('AVAILABLE');
    expect(before.body[0].isOverride).toBe(false);

    await request(app.getHttpServer())
      .put('/availability')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        entries: [
          {
            employeeId,
            dayOfWeek: 'MONDAY',
            status: 'UNAVAILABLE',
            weekStartDate: '2026-03-02',
            note: 'doctor appointment',
          },
        ],
      })
      .expect(200);

    const after = await request(app.getHttpServer())
      .get(`/availability?employeeId=${employeeId}&weekStart=2026-03-02`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(after.body).toHaveLength(1);
    expect(after.body[0].status).toBe('UNAVAILABLE');
    expect(after.body[0].isOverride).toBe(true);

    const otherWeek = await request(app.getHttpServer())
      .get(`/availability?employeeId=${employeeId}&weekStart=2026-03-09`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(otherWeek.body).toHaveLength(1);
    expect(otherWeek.body[0].status).toBe('AVAILABLE');
    expect(otherWeek.body[0].isOverride).toBe(false);
  });

  it('upserts idempotently: re-submitting the same recurring rule updates in place', async () => {
    const response = await request(app.getHttpServer())
      .put('/availability')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        entries: [{ employeeId, dayOfWeek: 'MONDAY', status: 'UNAVAILABLE' }],
      })
      .expect(200);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].status).toBe('UNAVAILABLE');

    const count = await prisma.employeeAvailability.count({
      where: { employeeId, dayOfWeek: 'MONDAY', weekStartDate: null },
    });
    expect(count).toBe(1);
  });
});
