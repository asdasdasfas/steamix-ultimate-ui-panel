import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import bcrypt from 'bcrypt';

const testDataDir = mkdtempSync(join(tmpdir(), 'iptv-expiry-enforce-'));
process.env.DATA_DIR = testDataDir;
const { default: db, initDb } = await import('../src/database/db.js');
const { authUser, authCache, getXtreamUser } = await import('../src/services/authService.js');

describe('subscription expiry enforcement', () => {
  const now = Math.floor(Date.now() / 1000);

  beforeAll(() => {
    initDb(true);
    authCache.clear();
    const pw = bcrypt.hashSync('trialpass123', 4);
    db.prepare(`INSERT INTO users (username, password, plain_password, expiry_date, token_version) VALUES (?, ?, ?, ?, 0)`)
      .run('expired_trial', pw, 'expired_trial', now - 60);
    db.prepare(`INSERT INTO users (username, password, plain_password, expiry_date, token_version) VALUES (?, ?, ?, ?, 0)`)
      .run('future_trial', pw, 'future_trial', now + 7200);
    db.prepare(`INSERT INTO users (username, password, plain_password, expiry_date, token_version) VALUES (?, ?, ?, ?, 0)`)
      .run('forever_trial', pw, null, null);
  });

  afterAll(() => {
    try { db?.close(); } catch (e) {}
    rmSync(testDataDir, { recursive: true, force: true });
  });

  it('authUser denies expired users even with correct password', async () => {
    expect(await authUser('expired_trial', 'trialpass123')).toBeNull();
  });

  it('authUser allows future and unlimited users', async () => {
    expect(await authUser('future_trial', 'trialpass123')).toMatchObject({ username: 'future_trial' });
    expect(await authUser('forever_trial', 'trialpass123')).toMatchObject({ username: 'forever_trial' });
  });

  it('getXtreamUser denies expired users via username/password', async () => {
    expect(await getXtreamUser({ query: { username: 'expired_trial', password: 'trialpass123' }, params: {}, ip: '127.0.0.1' })).toBeNull();
    expect(await getXtreamUser({ query: { username: 'future_trial', password: 'trialpass123' }, params: {}, ip: '127.0.0.1' })).toMatchObject({ username: 'future_trial' });
  });

  it('expired users stay denied on cached credentials', async () => {
    expect(await authUser('future_trial', 'trialpass123')).toMatchObject({ username: 'future_trial' });
    db.prepare('UPDATE users SET expiry_date = ? WHERE username = ?').run(now - 1, 'future_trial');
    expect(await authUser('future_trial', 'trialpass123')).toBeNull();
  });
});
