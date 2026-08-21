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
const OTHER_MANAGER_EMAIL = 'other-manager.e2e@example.com';
const OTHER_MANAGER_PASSWORD = 'OtherManager123!';

describe('Branch (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let ownerToken: string;
  let otherToken: string;
  let branchId: string;
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
        fullName: 'Other E2E Manager',
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
  });

  afterAll(async () => {
    if (branchId) {
      await prisma.branch.delete({ where: { id: branchId } }).catch(() => undefined);
    }
    await prisma.user.delete({ where: { id: otherManagerId } }).catch(() => undefined);
    await app.close();
  });

  it('rejects requests without an access token', () => {
    return request(app.getHttpServer()).get('/branches').expect(401);
  });

  it('creates a branch and assigns the creator to it', async () => {
    const response = await request(app.getHttpServer())
      .post('/branches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Kadikoy', timezone: 'Europe/Istanbul' })
      .expect(201);

    expect(response.body.name).toBe('Kadikoy');
    branchId = response.body.id;

    const list = await request(app.getHttpServer())
      .get('/branches')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(list.body.map((b: { id: string }) => b.id)).toContain(branchId);
  });

  it('does not show the branch to a manager who is not assigned to it', async () => {
    const list = await request(app.getHttpServer())
      .get('/branches')
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(200);
    expect(list.body.map((b: { id: string }) => b.id)).not.toContain(branchId);
  });

  it('forbids updating a branch you are not assigned to', () => {
    return request(app.getHttpServer())
      .patch(`/branches/${branchId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Hijacked' })
      .expect(403);
  });

  it('returns 404 for a branch that does not exist', () => {
    return request(app.getHttpServer())
      .patch('/branches/does-not-exist')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Whatever' })
      .expect(404);
  });

  it('allows the assigned manager to update the branch', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/branches/${branchId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Kadikoy Merkez' })
      .expect(200);
    expect(response.body.name).toBe('Kadikoy Merkez');
  });
});
