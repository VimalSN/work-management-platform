import request from 'supertest';
import { app } from '../app';
import { addTeamMember, closeTestConnections, registerOrgAdmin, resetDb } from './testHelpers';

beforeEach(resetDb);
afterAll(closeTestConnections);

describe('POST /auth/register', () => {
  it('creates a new organization with the caller as its Admin', async () => {
    const { accessToken, user } = await registerOrgAdmin();
    expect(accessToken).toEqual(expect.any(String));
    expect(user.role).toBe('ADMIN');
  });

  it('rejects a second registration with the same email', async () => {
    await registerOrgAdmin({ email: 'dup@example.com' });
    const res = await request(app)
      .post('/auth/register')
      .send({ organizationName: 'Another Org', name: 'Someone', email: 'dup@example.com', password: 'password123' });
    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  it('succeeds with the correct password', async () => {
    await registerOrgAdmin({ email: 'login@example.com', password: 'correct-password' });
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'login@example.com', password: 'correct-password' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('rejects an incorrect password without revealing whether the email exists', async () => {
    await registerOrgAdmin({ email: 'login2@example.com', password: 'correct-password' });
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'login2@example.com', password: 'wrong-password' });
    expect(res.status).toBe(401);

    const unknownEmail = await request(app)
      .post('/auth/login')
      .send({ email: 'never-registered@example.com', password: 'whatever123' });
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.error).toEqual(res.body.error);
  });
});

describe('GET /auth/me', () => {
  it("returns the caller's own profile when authenticated", async () => {
    const { accessToken, user } = await registerOrgAdmin();
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
  });

  it('rejects a request with no access token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a request with a garbage access token', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/users', () => {
  it('lets an Admin add a team member to their own organization', async () => {
    const { accessToken } = await registerOrgAdmin();
    const created = await addTeamMember(accessToken, { role: 'DEVELOPER' });
    expect(created.role).toBe('DEVELOPER');
  });

  it('refuses a non-Admin caller, even a valid one', async () => {
    const { accessToken: adminToken } = await registerOrgAdmin();
    await addTeamMember(adminToken, { email: 'dev@example.com', password: 'password123', role: 'DEVELOPER' });

    const devLogin = await request(app)
      .post('/auth/login')
      .send({ email: 'dev@example.com', password: 'password123' });
    const devToken = devLogin.body.accessToken;

    const res = await request(app)
      .post('/auth/users')
      .set('Authorization', `Bearer ${devToken}`)
      .send({ name: 'Someone Else', email: 'someone@example.com', password: 'password123', role: 'DEVELOPER' });
    expect(res.status).toBe(403);
  });
});
