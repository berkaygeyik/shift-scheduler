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
const OTHER_MANAGER_EMAIL = 'other-manager.shift-template.e2e@example.com';
const OTHER_MANAGER_PASSWORD = 'OtherManager123!';

describe('ShiftTemplate (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerToken: string;
  let otherToken: string;
  let branchId: string;
  let templateId: string;
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
        fullName: 'Other Shift-Template E2E Manager',
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
      .send({ name: 'Sisli', timezone: 'Europe/Istanbul' })
      .expect(201);
    branchId = branch.body.id;
  });

  afterAll(async () => {
    if (branchId) {
      await prisma.branch.delete({ where: { id: branchId } }).catch(() => undefined);
    }
    await prisma.user.delete({ where: { id: otherManagerId } }).catch(() => undefined);
    await app.close();
  });

  it('forbids creating a shift template on a branch you do not manage', () => {
    return request(app.getHttpServer())
      .post(`/branches/${branchId}/shift-templates`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Sabah', startTime: '08:00', endTime: '16:00', requiredStaffCount: 2 })
      .expect(403);
  });

  it('creates a shift template for a branch you manage', async () => {
    const response = await request(app.getHttpServer())
      .post(`/branches/${branchId}/shift-templates`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Sabah',
        startTime: '08:00',
        endTime: '16:00',
        requiredStaffCount: 2,
        isOpening: true,
        requiresKeyHolder: true,
      })
      .expect(201);

    expect(response.body.name).toBe('Sabah');
    expect(response.body.requiresKeyHolder).toBe(true);
    templateId = response.body.id;

    const list = await request(app.getHttpServer())
      .get(`/branches/${branchId}/shift-templates`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(list.body.map((t: { id: string }) => t.id)).toContain(templateId);
  });

  it('rejects an invalid time format', () => {
    return request(app.getHttpServer())
      .post(`/branches/${branchId}/shift-templates`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Bad', startTime: '8am', endTime: '16:00', requiredStaffCount: 1 })
      .expect(400);
  });

  it('returns 404 when patching a template that does not exist', () => {
    return request(app.getHttpServer())
      .patch('/shift-templates/does-not-exist')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Whatever' })
      .expect(404);
  });

  it('forbids patching a template on a branch you do not manage', () => {
    return request(app.getHttpServer())
      .patch(`/shift-templates/${templateId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Hijacked' })
      .expect(403);
  });

  it('allows the assigned manager to update the template', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/shift-templates/${templateId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ requiredStaffCount: 3 })
      .expect(200);
    expect(response.body.requiredStaffCount).toBe(3);
  });
});
