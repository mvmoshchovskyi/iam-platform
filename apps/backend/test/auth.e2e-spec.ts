import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import type { MailJobs, MailTemplate } from '../src/mail/mail.constants';
import { MailService } from '../src/mail/mail.service';

/** Captures outgoing emails instead of queueing them. */
class FakeMailService {
  readonly sent: { template: MailTemplate; data: MailJobs[MailTemplate] }[] = [];
  send<T extends MailTemplate>(template: T, data: MailJobs[T]): Promise<void> {
    this.sent.push({ template, data });
    return Promise.resolve();
  }
  lastTokenFor(template: MailTemplate, to: string): string {
    const mail = [...this.sent].reverse().find((m) => m.template === template && m.data.to === to);
    const url = (mail?.data as { url?: string } | undefined)?.url;
    if (!url) throw new Error(`No ${template} email sent to ${to}`);
    return new URL(url).searchParams.get('token')!;
  }
}

type Cookies = Record<string, string>;

const parseCookies = (res: request.Response): Cookies => {
  const header = res.headers['set-cookie'] as unknown as string[] | undefined;
  return Object.fromEntries(
    (header ?? []).map((c) => {
      const [pair] = c.split(';');
      const idx = pair.indexOf('=');
      return [pair.slice(0, idx), decodeURIComponent(pair.slice(idx + 1))];
    }),
  );
};

const cookieHeader = (cookies: Cookies) =>
  Object.entries(cookies)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('; ');

describe('Auth flow (e2e)', () => {
  let app: INestApplication<App>;
  let mail: FakeMailService;
  const email = `e2e.${Date.now()}@example.com`;
  const password = 'violet-Tractor-sings-42';

  beforeAll(async () => {
    // Clean slate for rate limiting / back-off / revocation keys
    const redis = new Redis({ host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) });
    await redis.flushdb();
    await redis.quit();

    mail = new FakeMailService();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue(mail)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const login = (body: Record<string, unknown> = { email, password }) =>
    http().post('/api/auth/login').send(body);
  const refresh = (cookies: Cookies) =>
    http()
      .post('/api/auth/refresh')
      .set('Cookie', cookieHeader(cookies))
      .set('X-CSRF-Token', cookies.csrf_token ?? '');

  it('registers, enforces email verification, then verifies', async () => {
    await http().post('/api/auth/register').send({ email, password, firstName: 'E2E' }).expect(201);

    const blocked = await login().expect(403);
    expect(blocked.headers['content-type']).toContain('application/problem+json');
    expect(blocked.body).toMatchObject({
      status: 403,
      code: 'EMAIL_NOT_VERIFIED',
      instance: '/api/auth/login',
    });

    const token = mail.lastTokenFor('verify-email', email);
    await http().post('/api/auth/verify-email').send({ token }).expect(200);
    await http().post('/api/auth/verify-email').send({ token }).expect(400);
  });

  it('rejects invalid credentials with a generic problem response', async () => {
    const res = await login({ email, password: 'wrong-password' }).expect(401);
    expect(res.body).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      detail: 'Invalid email or password',
    });
  });

  describe('login → refresh → logout', () => {
    let cookies: Cookies;
    let accessToken: string;

    it('logs in: access token in body, refresh token only in an HttpOnly cookie', async () => {
      const res = await login().expect(200);
      cookies = parseCookies(res);
      accessToken = res.body.accessToken;

      expect(res.body).toMatchObject({
        requiresTwoFactor: false,
        tokenType: 'Bearer',
        expiresIn: 900,
      });
      expect(res.body.user).toMatchObject({ email, roles: ['USER'] });
      expect(JSON.stringify(res.body)).not.toContain(cookies.refresh_token);

      const setCookie = (res.headers['set-cookie'] as unknown as string[]).join('\n');
      expect(setCookie).toMatch(
        /refresh_token=[^;]+; Path=\/api; Expires=[^;]+; HttpOnly; SameSite=Strict/,
      );
      expect(setCookie).toMatch(/csrf_token=[^;]+; Path=\/; Expires=[^;]+; SameSite=Strict/);

      await http().get('/api/users/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    });

    it('requires the CSRF header to refresh', async () => {
      const res = await http()
        .post('/api/auth/refresh')
        .set('Cookie', cookieHeader(cookies))
        .expect(403);
      expect(res.body.code).toBe('CSRF_INVALID');
    });

    it('rotates the refresh token and detects reuse of the old one', async () => {
      const res = await refresh(cookies).expect(200);
      const rotated = parseCookies(res);
      expect(rotated.refresh_token).toBeDefined();
      expect(rotated.refresh_token).not.toBe(cookies.refresh_token);
      expect(res.body.accessToken).toEqual(expect.any(String));

      // Replaying the old token revokes the whole family…
      const reuse = await refresh(cookies).expect(401);
      expect(reuse.body.code).toBe('REFRESH_TOKEN_REUSED');
      // …including the legitimately rotated token and the session's access tokens
      await refresh({ ...cookies, ...rotated }).expect(401);
      const me = await http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(401);
      expect(me.body.code).toBe('SESSION_REVOKED');
    });

    it('logs out: revokes the session and clears cookies', async () => {
      const res = await login().expect(200);
      const fresh = parseCookies(res);

      const out = await http()
        .post('/api/auth/logout')
        .set('Cookie', cookieHeader(fresh))
        .set('X-CSRF-Token', fresh.csrf_token)
        .expect(204);
      expect((out.headers['set-cookie'] as unknown as string[]).join('\n')).toMatch(
        /refresh_token=;/,
      );

      await refresh(fresh).expect(401);
      await http()
        .get('/api/users/me')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(401);
    });
  });

  it('lists sessions and revokes all other sessions', async () => {
    const first = await login().expect(200);
    const second = await login().expect(200);

    const list = await http()
      .get('/api/sessions')
      .set('Authorization', `Bearer ${second.body.accessToken}`)
      .expect(200);
    const sessions = list.body as { current: boolean }[];
    expect(sessions.filter((s) => s.current)).toHaveLength(1);

    await http()
      .delete('/api/sessions')
      .set('Authorization', `Bearer ${second.body.accessToken}`)
      .expect(200);
    await http()
      .get('/api/users/me')
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .expect(401);
    await http()
      .get('/api/users/me')
      .set('Authorization', `Bearer ${second.body.accessToken}`)
      .expect(200);
  });

  it('enforces RBAC on admin endpoints', async () => {
    const user = await login().expect(200);
    const forbidden = await http()
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${user.body.accessToken}`)
      .expect(403);
    expect(forbidden.body.code).toBe('FORBIDDEN_ROLE');

    const admin = await login({
      email: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
    }).expect(200);
    const users = await http()
      .get('/api/admin/users')
      .query({ search: email })
      .set('Authorization', `Bearer ${admin.body.accessToken}`)
      .expect(200);
    expect(users.body.items).toHaveLength(1);
    expect(users.body.items[0]).toMatchObject({ email, emailVerified: true });
  });

  it('requires authentication by default', async () => {
    const res = await http().get('/api/sessions').expect(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });
});
