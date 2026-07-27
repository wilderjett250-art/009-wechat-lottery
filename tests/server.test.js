import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, '..');

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function startServer(extraEnv = {}) {
  const port = await freePort();
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'lottery-tool-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      DATA_DIR: dataDir,
      ...extraEnv
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let output = '';
  child.stdout.on('data', chunk => {
    output += chunk.toString();
  });
  child.stderr.on('data', chunk => {
    output += chunk.toString();
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return {
          baseUrl,
          dataDir,
          child,
          async stop() {
            child.kill();
            await rm(dataDir, { recursive: true, force: true });
          }
        };
      }
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  child.kill();
  await rm(dataDir, { recursive: true, force: true });
  throw new Error(`server did not start on ${baseUrl}\n${output}`);
}

async function startCode2SessionMock(handler) {
  const port = await freePort();
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return {
    url: `http://127.0.0.1:${port}/sns/jscode2session`,
    close: () => new Promise(resolve => server.close(resolve))
  };
}

function encryptGroupInfo(sessionKey, openGId) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(sessionKey, 'base64'), iv);
  const encryptedData = Buffer.concat([
    cipher.update(JSON.stringify({
      openGId,
      watermark: { appid: 'wxexampleappid0001', timestamp: Math.floor(Date.now() / 1000) }
    }), 'utf8'),
    cipher.final()
  ]).toString('base64');
  return { encryptedData, iv: iv.toString('base64') };
}

function encryptWechatOpenCallback({ appid, token, aesKey, messageXml, timestamp = '1700000000', nonce = 'nonce' }) {
  const key = Buffer.from(`${aesKey}=`, 'base64');
  const message = Buffer.from(messageXml, 'utf8');
  const appidBuffer = Buffer.from(appid, 'utf8');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(message.length);
  let clear = Buffer.concat([crypto.randomBytes(16), length, message, appidBuffer]);
  const padding = 32 - (clear.length % 32 || 32);
  const paddingLength = padding || 32;
  clear = Buffer.concat([clear, Buffer.alloc(paddingLength, paddingLength)]);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, key.subarray(0, 16));
  cipher.setAutoPadding(false);
  const encrypted = Buffer.concat([cipher.update(clear), cipher.final()]).toString('base64');
  const msgSignature = crypto.createHash('sha1')
    .update([token, timestamp, nonce, encrypted].sort().join(''))
    .digest('hex');
  return {
    body: `<xml><AppId><![CDATA[${appid}]]></AppId><Encrypt><![CDATA[${encrypted}]]></Encrypt></xml>`,
    query: new URLSearchParams({ timestamp, nonce, msg_signature: msgSignature }).toString()
  };
}

async function loginTestUser(baseUrl, code) {
  const response = await fetch(`${baseUrl}/api/auth/wechat-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  assert.equal(response.status, 200);
  return (await response.json()).data;
}

async function createTestActivity(baseUrl, sessionId, conditions = {}) {
  const response = await fetch(`${baseUrl}/api/activities`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionId}`
    },
    body: JSON.stringify({
      prizes: [{ name: '真实条件测试奖品', quantity: 1, type: '奖品' }],
      drawMode: 'time',
      drawAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      conditions
    })
  });
  const payload = await response.json();
  assert.equal(response.status, 200, payload.msg);
  return payload.data;
}

test('uses DATA_DIR for runtime database writes', async () => {
  const server = await startServer();
  try {
    assert.equal(await exists(path.join(server.dataDir, 'db.json')), true);
  } finally {
    await server.stop();
  }
});

test('returns a JSON error without a stack trace for malformed request bodies', async () => {
  const server = await startServer();
  try {
    const response = await fetch(`${server.baseUrl}/api/auth/wechat-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json'
    });
    const text = await response.text();
    assert.equal(response.status, 400);
    assert.match(response.headers.get('content-type') || '', /application\/json/);
    assert.deepEqual(JSON.parse(text), { code: 400, msg: '请求数据格式错误' });
    assert.doesNotMatch(text, /SyntaxError|node_modules|server\.js/);
  } finally {
    await server.stop();
  }
});

test('hides bundled sample activities from public production responses when configured', async () => {
  const server = await startServer({ HIDE_SAMPLE_DATA: 'true' });
  try {
    const publicResponse = await fetch(`${server.baseUrl}/api/activities`);
    const publicPayload = await publicResponse.json();
    assert.deepEqual(publicPayload.data, []);

    const adminResponse = await fetch(`${server.baseUrl}/api/admin/activities`);
    const adminPayload = await adminResponse.json();
    assert.equal(adminPayload.data.length, 8);
  } finally {
    await server.stop();
  }
});

test('protects admin page and API when ADMIN_TOKEN is configured', async () => {
  const server = await startServer({ ADMIN_TOKEN: 'secret-token' });
  try {
    const publicHealth = await fetch(`${server.baseUrl}/api/health`);
    assert.equal(publicHealth.status, 200);

    const blockedApi = await fetch(`${server.baseUrl}/api/admin/summary`);
    assert.equal(blockedApi.status, 401);

    const blockedPage = await fetch(`${server.baseUrl}/admin`);
    assert.equal(blockedPage.status, 200);
    assert.match(await blockedPage.text(), /adminLoginForm/);

    const queryPage = await fetch(`${server.baseUrl}/admin?token=secret-token`);
    assert.equal(queryPage.status, 200);
    assert.match(await queryPage.text(), /adminLoginForm/);

    const loginResponse = await fetch(`${server.baseUrl}/api/admin/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'secret-token' })
    });
    assert.equal(loginResponse.status, 200);
    const cookie = loginResponse.headers.get('set-cookie') || '';
    assert.match(cookie, /admin_session=/);
    const cookieHeader = cookie.split(';')[0];

    const allowedApi = await fetch(`${server.baseUrl}/api/admin/summary`, {
      headers: { Cookie: cookieHeader }
    });
    assert.equal(allowedApi.status, 200);
    const allowedPage = await fetch(`${server.baseUrl}/admin`, {
      headers: { Cookie: cookieHeader }
    });
    assert.equal(allowedPage.status, 200);
    assert.match(await allowedPage.text(), /admin-shell/);
  } finally {
    await server.stop();
  }
});

test('admin-created activities default to server-side automatic draw', async () => {
  const server = await startServer({ ADMIN_TOKEN: 'auto-draw-admin' });
  try {
    const response = await fetch(`${server.baseUrl}/api/admin/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer auto-draw-admin'
      },
      body: JSON.stringify({
        title: '自动开奖代码路径测试',
        drawAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        drawMode: 'time'
      })
    });
    const payload = await response.json();
    assert.equal(response.status, 200, payload.msg);
    assert.equal(payload.data.autoDraw, true);
  } finally {
    await server.stop();
  }
});

test('login rate limiting returns a retryable JSON response', async () => {
  const server = await startServer({ LOGIN_RATE_LIMIT_MAX: '1' });
  try {
    const first = await fetch(`${server.baseUrl}/api/auth/wechat-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(first.status, 400);
    const second = await fetch(`${server.baseUrl}/api/auth/wechat-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const payload = await second.json();
    assert.equal(second.status, 429);
    assert.equal(payload.code, 429);
    assert.match(second.headers.get('retry-after') || '', /^\d+$/);
  } finally {
    await server.stop();
  }
});

test('serves anonymous member center data and protects activity creation', async () => {
  const server = await startServer();
  try {
    const overviewResponse = await fetch(`${server.baseUrl}/api/me/overview`);
    assert.equal(overviewResponse.status, 200);
    const overview = await overviewResponse.json();
    assert.equal(overview.code, 0);
    assert.equal(overview.data.authenticated, false);
    assert.equal(overview.data.profile, null);
    assert.deepEqual(overview.data.stats, { total: 0, created: 0, won: 0 });
    assert.deepEqual(overview.data.wallet, { balance: 0, frozen: 0 });
    assert.equal(overview.data.couponCount, 0);
    assert.equal(overview.data.orderCount, 0);

    const runtimeDb = JSON.parse(await readFile(path.join(server.dataDir, 'db.json'), 'utf8'));
    assert.deepEqual(runtimeDb.memberStats, { total: 0, created: 0, won: 0 });
    assert.deepEqual(runtimeDb.wallet, { balance: 0, frozen: 0, records: [] });
    assert.deepEqual(runtimeDb.coupons, []);
    assert.deepEqual(runtimeDb.orders, []);

    const createResponse = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prizeName: '测试奖品',
        prizeQuantity: 2,
        prizeType: '奖品',
        drawMode: 'time',
        drawAt: '2026-07-05T12:00:00.000Z',
        description: '用于接口验证的抽奖',
        status: 'live'
      })
    });
    assert.equal(createResponse.status, 401);

    for (const pathname of [
      '/api/activities/resolve-passcode',
      '/api/me/check-in'
    ]) {
      const removedResponse = await fetch(`${server.baseUrl}${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      assert.equal(removedResponse.status, 404);
    }
  } finally {
    await server.stop();
  }
});

test('exchanges wx.login code for openid and stores local session', async () => {
  const requests = [];
  const code2session = await startCode2SessionMock((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    requests.push(Object.fromEntries(url.searchParams.entries()));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      openid: 'openid_test_member',
      session_key: 'session_key_for_test',
      unionid: 'union_test_member'
    }));
  });

  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'test-secret',
    WECHAT_CODE2SESSION_URL: code2session.url
  });

  try {
    const missingCode = await fetch(`${server.baseUrl}/api/auth/wechat-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.equal(missingCode.status, 400);

    const silentLoginResponse = await fetch(`${server.baseUrl}/api/auth/wechat-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'wx-code-silent' })
    });
    assert.equal(silentLoginResponse.status, 200);
    const silentLogin = await silentLoginResponse.json();
    assert.equal(silentLogin.data.profile.profileCompleted, false);

    const loginResponse = await fetch(`${server.baseUrl}/api/auth/wechat-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'wx-code-from-client',
        nickname: '体验用户',
        profileConfirmed: true
      })
    });
    assert.equal(loginResponse.status, 200);
    const login = await loginResponse.json();
    assert.equal(login.code, 0);
    assert.equal(login.data.openid, 'openid_test_member');
    assert.equal(typeof login.data.sessionId, 'string');
    assert.equal(login.data.profile.nickname, '体验用户');
    assert.equal(login.data.profile.profileCompleted, true);

    assert.equal(requests.length, 2);
    assert.equal(requests[1].appid, 'wxexampleappid0001');
    assert.equal(requests[1].secret, 'test-secret');
    assert.equal(requests[1].js_code, 'wx-code-from-client');

    const runtimeDb = JSON.parse(await readFile(path.join(server.dataDir, 'db.json'), 'utf8'));
    assert.equal(runtimeDb.members[0].openid, 'openid_test_member');
    assert.equal(runtimeDb.sessions[0].openid, 'openid_test_member');

    const overviewResponse = await fetch(`${server.baseUrl}/api/me/overview`, {
      headers: { Authorization: `Bearer ${login.data.sessionId}` }
    });
    assert.equal(overviewResponse.status, 200);
    const overview = await overviewResponse.json();
    assert.equal(overview.code, 0);
    assert.equal(overview.data.authenticated, true);
    assert.equal(overview.data.profile.nickname, '体验用户');
    assert.equal(overview.data.profile.profileCompleted, true);
    assert.equal(overview.data.profile.openid, undefined);
    assert.deepEqual(overview.data.stats, { total: 0, created: 0, won: 0 });
    assert.deepEqual(overview.data.wallet, { balance: 0, frozen: 0 });
    assert.equal(overview.data.couponCount, 0);
    assert.equal(overview.data.orderCount, 0);

    const profileResponse = await fetch(`${server.baseUrl}/api/me/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${login.data.sessionId}`
      },
      body: JSON.stringify({ nickname: '更新后的昵称', avatar: '/assets/avatar-default.svg' })
    });
    assert.equal(profileResponse.status, 200);
    const updatedProfile = (await profileResponse.json()).data;
    assert.equal(updatedProfile.nickname, '更新后的昵称');
    assert.equal(updatedProfile.profileCompleted, true);
  } finally {
    await server.stop();
    await code2session.close();
  }
});

test('keeps active sessions beyond the old 200-session cap and removes expired sessions on login', async () => {
  const code2session = await startCode2SessionMock((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ openid: 'openid_new_session', session_key: 'session_new' }));
  });
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'session-secret',
    WECHAT_CODE2SESSION_URL: code2session.url
  });

  try {
    await new Promise(resolve => setTimeout(resolve, 100));
    const dbPath = path.join(server.dataDir, 'db.json');
    const runtimeDb = JSON.parse(await readFile(dbPath, 'utf8'));
    const now = new Date().toISOString();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    runtimeDb.members.push({
      id: 'legacy_member',
      openid: 'openid_legacy_session',
      nickname: '历史用户',
      avatar: '/assets/avatar-default.svg',
      createdAt: now,
      updatedAt: now
    });
    runtimeDb.sessions = Array.from({ length: 250 }, (_, index) => ({
      id: `legacy_session_${index}`,
      openid: 'openid_legacy_session',
      createdAt: now,
      expiresAt: future
    }));
    runtimeDb.sessions.push({
      id: 'expired_session',
      openid: 'openid_legacy_session',
      createdAt: now,
      expiresAt: new Date(Date.now() - 1_000).toISOString()
    });
    await writeFile(dbPath, JSON.stringify(runtimeDb, null, 2), 'utf8');

    const login = await loginTestUser(server.baseUrl, 'new-session');
    const afterLogin = JSON.parse(await readFile(dbPath, 'utf8'));
    assert.equal(afterLogin.sessions.length, 251);
    assert.ok(afterLogin.sessions.some(item => item.id === 'legacy_session_249'));
    assert.ok(!afterLogin.sessions.some(item => item.id === 'expired_session'));
    assert.ok(Date.parse(afterLogin.sessions.find(item => item.id === login.sessionId).expiresAt) > Date.now() + 29 * 24 * 60 * 60 * 1000);
  } finally {
    await server.stop();
    await code2session.close();
  }
});

test('uploads authenticated images and creates all submitted prize tiers', async () => {
  const code2session = await startCode2SessionMock((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      openid: 'openid_multi_prize_owner',
      session_key: 'session_multi_prize_owner'
    }));
  });
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'test-secret',
    WECHAT_CODE2SESSION_URL: code2session.url
  });

  try {
    const loginResponse = await fetch(`${server.baseUrl}/api/auth/wechat-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'multi-prize-owner' })
    });
    const login = (await loginResponse.json()).data;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${login.sessionId}`
    };

    const anonymousUpload = await fetch(`${server.baseUrl}/api/uploads/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mimeType: 'image/png', base64: 'aGVsbG8=' })
    });
    assert.equal(anonymousUpload.status, 401);

    const uploadResponse = await fetch(`${server.baseUrl}/api/uploads/image`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ mimeType: 'image/png', base64: 'iVBORw0KGgo=' })
    });
    assert.equal(uploadResponse.status, 200);
    const uploaded = (await uploadResponse.json()).data;
    assert.match(uploaded.url, /^\/uploads\/image_.+\.png$/);
    assert.equal(await exists(path.join(server.dataDir, uploaded.url.replace(/^\//, ''))), true);

    const anonymousFileForm = new FormData();
    anonymousFileForm.append('file', new Blob([Buffer.from('iVBORw0KGgo=', 'base64')], { type: 'image/png' }), 'avatar.png');
    const anonymousFileUpload = await fetch(`${server.baseUrl}/api/uploads/image-file`, {
      method: 'POST',
      body: anonymousFileForm
    });
    assert.equal(anonymousFileUpload.status, 401);

    const fileForm = new FormData();
    fileForm.append('file', new Blob([Buffer.from('iVBORw0KGgo=', 'base64')], { type: 'image/png' }), 'avatar.png');
    const fileUploadResponse = await fetch(`${server.baseUrl}/api/uploads/image-file`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${login.sessionId}` },
      body: fileForm
    });
    assert.equal(fileUploadResponse.status, 200);
    const fileUploaded = (await fileUploadResponse.json()).data;
    assert.match(fileUploaded.url, /^\/uploads\/image_.+\.png$/);
    assert.equal(await exists(path.join(server.dataDir, fileUploaded.url.replace(/^\//, ''))), true);

    const createResponse = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prizes: [
          {
            name: '一等奖相机',
            quantity: 1,
            type: '奖品',
            image: uploaded.url,
            deliveryMethod: '发起人发货'
          },
          {
            name: '二等奖优惠券',
            quantity: 3,
            type: '优惠券',
            faceValue: 8,
            deliveryMethod: '系统自动发放'
          }
        ],
        drawMode: 'time',
        drawAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        leadInfo: '请在中奖后联系活动客服',
        introImages: [uploaded.url]
      })
    });
    assert.equal(createResponse.status, 200);
    const activity = (await createResponse.json()).data;
    assert.equal(activity.prizes.length, 2);
    assert.deepEqual(activity.prizes.map(item => item.name), ['一等奖相机', '二等奖优惠券']);
    assert.equal(activity.prizes[1].deliveryMethod, '系统自动发放');
    assert.equal(activity.metrics.prizeCount, 4);
    assert.equal(activity.leadInfo, '请在中奖后联系活动客服');
    assert.deepEqual(activity.introImages, [uploaded.url]);
  } finally {
    await server.stop();
    await code2session.close();
  }
});

test('binds activities, participation, records, and people draws to the logged-in member', async () => {
  const code2session = await startCode2SessionMock((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const code = url.searchParams.get('js_code') || 'member';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      openid: `openid_${code}`,
      session_key: `session_${code}`
    }));
  });
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'test-secret',
    WECHAT_CODE2SESSION_URL: code2session.url
  });

  async function login(code, nickname) {
    const response = await fetch(`${server.baseUrl}/api/auth/wechat-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, nickname })
    });
    assert.equal(response.status, 200);
    return (await response.json()).data;
  }

  try {
    const owner = await login('owner', 'Owner');
    const guest = await login('guest', 'Guest');
    const ownerHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${owner.sessionId}`
    };

    const createResponse = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        prizeName: 'Two prizes',
        prizeQuantity: 2,
        drawMode: 'people',
        drawParticipantTarget: 2,
        drawAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
    });
    assert.equal(createResponse.status, 200);
    const activity = (await createResponse.json()).data;
    assert.equal(activity.drawMode, 'people');
    assert.equal(activity.drawParticipantTarget, 2);

    const joinOwner = await fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ nickname: 'Untrusted name' })
    });
    assert.equal(joinOwner.status, 200);
    assert.equal((await joinOwner.json()).data.winners.length, 0);

    const joinGuest = await fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guest.sessionId}`
      },
      body: JSON.stringify({})
    });
    assert.equal(joinGuest.status, 200);
    assert.equal((await joinGuest.json()).data.winners.length, 2);

    const anonymousActivity = await fetch(`${server.baseUrl}/api/activities/${activity.id}`);
    const anonymousPayload = (await anonymousActivity.json()).data;
    assert.equal(anonymousPayload.joined, false);
    assert.equal(anonymousPayload.participants[0].memberOpenid, undefined);
    assert.equal(anonymousPayload.participants[0].phone, undefined);
    assert.match(anonymousPayload.participants[0].nickname, /^.\*{3}.$/u);
    assert.notEqual(anonymousPayload.participants[0].nickname, 'Guest');

    const recordsResponse = await fetch(`${server.baseUrl}/api/me/records`, {
      headers: { Authorization: `Bearer ${owner.sessionId}` }
    });
    const records = (await recordsResponse.json()).data;
    assert.equal(records.created[0].id, activity.id);
    assert.equal(records.joined[0].id, activity.id);
    assert.equal(records.won[0].id, activity.id);

    const overviewResponse = await fetch(`${server.baseUrl}/api/me/overview`, {
      headers: { Authorization: `Bearer ${owner.sessionId}` }
    });
    const overview = (await overviewResponse.json()).data;
    assert.deepEqual(overview.stats, { total: 1, created: 1, won: 1 });

    const runtimeDb = JSON.parse(await readFile(path.join(server.dataDir, 'db.json'), 'utf8'));
    assert.equal(runtimeDb.activities[0].creatorOpenid, 'openid_owner');
    assert.equal(runtimeDb.participants
      .filter(item => item.activityId === activity.id)
      .every(item => item.memberOpenid), true);
  } finally {
    await server.stop();
    await code2session.close();
  }
});

test('fulfills wallet, coupon, code, and order prizes exactly once', async () => {
  const code2session = await startCode2SessionMock((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const code = url.searchParams.get('js_code') || 'member';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ openid: `openid_${code}`, session_key: `session_${code}` }));
  });
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'test-secret',
    WECHAT_CODE2SESSION_URL: code2session.url
  });

  async function login(code) {
    const response = await fetch(`${server.baseUrl}/api/auth/wechat-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, nickname: code })
    });
    assert.equal(response.status, 200);
    return (await response.json()).data;
  }

  try {
    const owner = await login('fulfillment-owner');
    const guests = await Promise.all([
      login('fulfillment-guest-1'),
      login('fulfillment-guest-2'),
      login('fulfillment-guest-3'),
      login('fulfillment-guest-4')
    ]);
    const ownerHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${owner.sessionId}`
    };
    const createResponse = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        prizes: [
          { name: '现金红包', type: '红包', faceValue: 6.66, quantity: 1, deliveryMethod: '系统自动发放' },
          { name: '满减券', type: '优惠券', faceValue: 20, quantity: 1, deliveryMethod: '系统自动发放' },
          { name: '兑换资格', type: '兑换码', quantity: 1, deliveryMethod: '系统自动发放' },
          { name: '实物礼盒', type: '商城奖品', quantity: 1, deliveryMethod: '发起人发货' }
        ],
        drawMode: 'time',
        drawAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
    });
    assert.equal(createResponse.status, 200);
    const activity = (await createResponse.json()).data;

    for (const guest of guests) {
      const joinResponse = await fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${guest.sessionId}`
        },
        body: JSON.stringify({})
      });
      assert.equal(joinResponse.status, 200);
    }

    const drawResponse = await fetch(`${server.baseUrl}/api/admin/activities/${activity.id}/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 4 })
    });
    assert.equal(drawResponse.status, 200);
    assert.equal((await drawResponse.json()).data.length, 4);

    const dbPath = path.join(server.dataDir, 'db.json');
    const runtimeDb = JSON.parse(await readFile(dbPath, 'utf8'));
    assert.equal(runtimeDb.wallet.records.filter(item => item.activityId === activity.id).length, 1);
    assert.equal(runtimeDb.wallet.records.find(item => item.activityId === activity.id).amount, 6.66);
    assert.equal(runtimeDb.coupons.filter(item => item.activityId === activity.id).length, 2);
    assert.equal(runtimeDb.coupons.some(item => item.value === '¥20.00'), true);
    assert.equal(runtimeDb.coupons.some(item => /^[A-F0-9]{12}$/.test(item.code || '')), true);
    assert.equal(runtimeDb.orders.filter(item => item.activityId === activity.id).length, 1);
    assert.equal(runtimeDb.orders.find(item => item.activityId === activity.id).status, '待发货');
    assert.equal(runtimeDb.winners.filter(item => item.activityId === activity.id && item.fulfillmentId).length, 4);

    const secondDraw = await fetch(`${server.baseUrl}/api/admin/activities/${activity.id}/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 4 })
    });
    assert.equal(secondDraw.status, 409);
    const afterSecondDraw = JSON.parse(await readFile(dbPath, 'utf8'));
    assert.equal(afterSecondDraw.wallet.records.filter(item => item.activityId === activity.id).length, 1);
    assert.equal(afterSecondDraw.coupons.filter(item => item.activityId === activity.id).length, 2);
    assert.equal(afterSecondDraw.orders.filter(item => item.activityId === activity.id).length, 1);

  } finally {
    await server.stop();
    await code2session.close();
  }
});

test('instant draw enforces real attempt and participant limits while fulfilling prizes', async () => {
  const code2session = await startCode2SessionMock((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const code = url.searchParams.get('js_code') || 'member';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ openid: `openid_${code}`, session_key: `session_${code}` }));
  });
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'test-secret',
    WECHAT_CODE2SESSION_URL: code2session.url
  });

  async function login(code) {
    const response = await fetch(`${server.baseUrl}/api/auth/wechat-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, nickname: code })
    });
    return (await response.json()).data;
  }

  try {
    const owner = await login('instant-owner');
    const guests = [];
    for (let index = 1; index <= 6; index += 1) guests.push(await login(`instant-guest-${index}`));
    const createResponse = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner.sessionId}`
      },
      body: JSON.stringify({
        prizes: [{ name: '即开红包', type: '红包', faceValue: 3.5, quantity: 10 }],
        drawMode: 'instant',
        drawAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        instantPerUserLimit: 2,
        instantParticipantLimit: 5
      })
    });
    assert.equal(createResponse.status, 200);
    const activity = (await createResponse.json()).data;
    const firstGuestHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guests[0].sessionId}`
    };
    const firstAttempt = await fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
      method: 'POST',
      headers: firstGuestHeaders,
      body: JSON.stringify({})
    });
    assert.equal(firstAttempt.status, 200);
    const firstAttemptData = (await firstAttempt.json()).data;
    assert.equal(firstAttemptData.winners.length, 1);
    assert.equal(firstAttemptData.attemptsUsed, 1);
    assert.equal(firstAttemptData.attemptsRemaining, 1);

    const secondAttempt = await fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
      method: 'POST',
      headers: firstGuestHeaders,
      body: JSON.stringify({})
    });
    assert.equal(secondAttempt.status, 200);
    const secondAttemptData = (await secondAttempt.json()).data;
    assert.equal(secondAttemptData.winners.length, 0);
    assert.equal(secondAttemptData.attemptsUsed, 2);
    assert.equal(secondAttemptData.attemptsRemaining, 0);

    const thirdAttempt = await fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
      method: 'POST',
      headers: firstGuestHeaders,
      body: JSON.stringify({})
    });
    assert.equal(thirdAttempt.status, 409);

    for (const guest of guests.slice(1, 5)) {
      const response = await fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${guest.sessionId}`
        },
        body: JSON.stringify({})
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).data.winners.length, 1);
    }

    const overCapacity = await fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guests[5].sessionId}`
      },
      body: JSON.stringify({})
    });
    assert.equal(overCapacity.status, 409);

    const wallet = (await (await fetch(`${server.baseUrl}/api/me/wallet`, { headers: firstGuestHeaders })).json()).data;
    assert.equal(wallet.balance, 3.5);
    assert.equal(wallet.records.length, 1);
  } finally {
    await server.stop();
    await code2session.close();
  }
});

test('unlocks prize tiers by real participant counts and auto-draws at the people target', async () => {
  const code2session = await startCode2SessionMock((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const code = url.searchParams.get('js_code') || 'member';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ openid: `openid_${code}`, session_key: `session_${code}` }));
  });
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'test-secret',
    WECHAT_CODE2SESSION_URL: code2session.url
  });

  try {
    const owner = await loginTestUser(server.baseUrl, 'unlock-owner');
    const guests = [];
    for (let index = 1; index <= 4; index += 1) {
      guests.push(await loginTestUser(server.baseUrl, `unlock-guest-${index}`));
    }
    const createHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${owner.sessionId}`
    };
    const createUnlocked = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({
        prizes: [
          { name: '一等奖', quantity: 1, type: '奖品', unlockParticipants: 3 },
          { name: '二等奖', quantity: 1, type: '奖品', unlockParticipants: 2 },
          { name: '末等奖', quantity: 1, type: '奖品', unlockParticipants: 0 }
        ],
        drawMode: 'time',
        drawAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        unlockByPeople: true
      })
    });
    assert.equal(createUnlocked.status, 200);
    const unlockedActivity = (await createUnlocked.json()).data;
    for (const guest of guests.slice(0, 2)) {
      const response = await fetch(`${server.baseUrl}/api/activities/${unlockedActivity.id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${guest.sessionId}`
        },
        body: JSON.stringify({})
      });
      assert.equal(response.status, 200);
    }
    const drawResponse = await fetch(`${server.baseUrl}/api/admin/activities/${unlockedActivity.id}/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 3 })
    });
    assert.equal(drawResponse.status, 200);
    const unlockedWinners = (await drawResponse.json()).data;
    assert.equal(unlockedWinners.length, 2);
    assert.deepEqual(new Set(unlockedWinners.map(item => item.prize.name)), new Set(['二等奖', '末等奖']));

    const createPeople = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers: createHeaders,
      body: JSON.stringify({
        prizes: [{ name: '人数开奖奖品', quantity: 1, type: '奖品' }],
        drawMode: 'people',
        drawParticipantTarget: 2,
        drawAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      })
    });
    assert.equal(createPeople.status, 200);
    const peopleActivity = (await createPeople.json()).data;
    for (let index = 2; index < 4; index += 1) {
      const response = await fetch(`${server.baseUrl}/api/activities/${peopleActivity.id}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${guests[index].sessionId}`
        },
        body: JSON.stringify({})
      });
      assert.equal(response.status, 200);
      const data = (await response.json()).data;
      assert.equal(data.winners.length, index === 3 ? 1 : 0);
    }
    const peopleDetail = await fetch(`${server.baseUrl}/api/activities/${peopleActivity.id}`, {
      headers: { Authorization: `Bearer ${owner.sessionId}` }
    });
    const peopleData = (await peopleDetail.json()).data;
    assert.equal(peopleData.status, 'drawn');
    assert.equal(peopleData.winners.length, 1);
  } finally {
    await server.stop();
    await code2session.close();
  }
});

test('binds a lottery to its WeChat group and rejects participation from another group', async () => {
  const sessionKey = Buffer.from('0123456789abcdef').toString('base64');
  const code2session = await startCode2SessionMock((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const code = url.searchParams.get('js_code') || '';
    const openid = code.startsWith('owner') ? 'openid_group_owner' : 'openid_group_guest';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ openid, session_key: sessionKey }));
  });
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'group-proof-test-secret',
    WECHAT_CODE2SESSION_URL: code2session.url
  });

  async function login(code, nickname) {
    const response = await fetch(`${server.baseUrl}/api/auth/wechat-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, nickname })
    });
    return (await response.json()).data;
  }

  async function groupProof(token, code, openGId) {
    const encrypted = encryptGroupInfo(sessionKey, openGId);
    const response = await fetch(`${server.baseUrl}/api/wechat/group-proof`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ code, ...encrypted })
    });
    assert.equal(response.status, 200);
    return (await response.json()).data.groupProof;
  }

  try {
    const owner = await login('owner-login', 'Group owner');
    const guest = await login('guest-login', 'Group guest');
    const ownerProof = await groupProof(owner.sessionId, 'owner-proof', 'group_alpha');
    const createResponse = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner.sessionId}`
      },
      body: JSON.stringify({
        prizeName: 'Group prize',
        prizeQuantity: 1,
        drawAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        conditions: { groupOnly: true, groupType: 'wechat' },
        groupProof: ownerProof
      })
    });
    assert.equal(createResponse.status, 200);
    const activity = (await createResponse.json()).data;
    assert.deepEqual(activity.conditions, {
      assist: false,
      assistWeight: 1,
      assistLimit: 5,
      groupOnly: true,
      groupType: 'wechat',
      enterpriseName: '',
      fansOnly: false,
      officialAccountName: '',
      officialAccountUsername: '',
      review: false,
      reviewPrompt: '',
      wecom: false,
      wecomName: '',
      region: false,
      regionConfig: null,
      survey: false,
      surveyQuestions: [],
      task: false,
      taskText: '',
      answer: false,
      answerQuestion: '',
      vote: false,
      voteQuestion: '',
      voteOptions: []
    });
    assert.equal(JSON.stringify(activity).includes('group_alpha'), false);

    const wrongProof = await groupProof(guest.sessionId, 'guest-wrong', 'group_beta');
    const wrongGroupJoin = await fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guest.sessionId}`
      },
      body: JSON.stringify({ groupProof: wrongProof })
    });
    assert.equal(wrongGroupJoin.status, 403);

    const correctProof = await groupProof(guest.sessionId, 'guest-correct', 'group_alpha');
    const correctGroupJoin = await fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guest.sessionId}`
      },
      body: JSON.stringify({ groupProof: correctProof })
    });
    assert.equal(correctGroupJoin.status, 200);
    assert.equal((await correctGroupJoin.json()).data.joined, true);

    const unboundWecomCreate = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner.sessionId}`
      },
      body: JSON.stringify({
        prizeName: 'WeCom prize',
        prizeQuantity: 1,
        drawAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        conditions: { groupOnly: true, groupType: 'wecom' }
      })
    });
    assert.equal(unboundWecomCreate.status, 409);
  } finally {
    await server.stop();
    await code2session.close();
  }
});

test('serializes concurrent participation requests for the same member', async () => {
  const code2session = await startCode2SessionMock((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ openid: 'openid_concurrent_member', session_key: 'session_concurrent_member' }));
  });
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'test-secret',
    WECHAT_CODE2SESSION_URL: code2session.url
  });

  try {
    const loginResponse = await fetch(`${server.baseUrl}/api/auth/wechat-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'concurrent-code', nickname: 'Concurrent member' })
    });
    const login = (await loginResponse.json()).data;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${login.sessionId}`
    };
    const createResponse = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prizeName: 'Concurrent prize',
        prizeQuantity: 1,
        drawMode: 'time',
        drawAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
    });
    const activity = (await createResponse.json()).data;

    const responses = await Promise.all(
      [1, 2].map(() => fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      }).then(response => response.json()))
    );
    assert.equal(responses.filter(item => item.data.joined).length, 1);
    assert.equal(responses.filter(item => !item.data.joined).length, 1);

    const detailResponse = await fetch(`${server.baseUrl}/api/activities/${activity.id}`, { headers });
    const detail = (await detailResponse.json()).data;
    assert.equal(detail.metrics.participantCount, 1);
  } finally {
    await server.stop();
    await code2session.close();
  }
});

test('records accepted subscriptions and sends a draw notification after the admin draw', async () => {
  const calls = [];
  const external = await startCode2SessionMock((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      calls.push({ path: url.pathname, query: Object.fromEntries(url.searchParams.entries()), body });
      res.setHeader('Content-Type', 'application/json');
      if (url.pathname === '/sns/jscode2session') {
        res.end(JSON.stringify({ openid: 'openid_notice_member', session_key: 'session_notice_member' }));
        return;
      }
      if (url.pathname === '/token') {
        res.end(JSON.stringify({ access_token: 'access-token', expires_in: 7200 }));
        return;
      }
      if (url.pathname === '/send') {
        res.end(JSON.stringify({ errcode: 0, msgid: 12345 }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ errcode: 404 }));
    });
  });
  const origin = new URL(external.url).origin;
  const server = await startServer({
    ADMIN_TOKEN: 'admin-token',
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'test-secret',
    WECHAT_CODE2SESSION_URL: external.url,
    WECHAT_ACCESS_TOKEN_URL: `${origin}/token`,
    WECHAT_SUBSCRIBE_SEND_URL: `${origin}/send`,
    WECHAT_DRAW_TEMPLATE_ID: 'draw-template',
    WECHAT_DRAW_TEMPLATE_DATA: JSON.stringify({
      thing10: { value: '{{activityTitle}}' },
      thing2: { value: '{{prizeName}}' },
      thing4: { value: '{{result}}' },
      time7: { value: '{{drawAt}}' },
      thing1: { value: '请进入小程序查看详情' }
    })
  });

  try {
    const loginResponse = await fetch(`${server.baseUrl}/api/auth/wechat-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'notice-code', nickname: 'Notice member' })
    });
    const login = (await loginResponse.json()).data;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${login.sessionId}`
    };
    const createResponse = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prizeName: 'Message prize',
        prizeQuantity: 1,
        drawMode: 'time',
        drawAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
    });
    const activity = (await createResponse.json()).data;

    const joinResponse = await fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    assert.equal(joinResponse.status, 200);

    const subscriptionResponse = await fetch(`${server.baseUrl}/api/me/subscriptions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ activityId: activity.id, type: 'draw_result' })
    });
    assert.equal(subscriptionResponse.status, 200);

    const drawResponse = await fetch(`${server.baseUrl}/api/admin/activities/${activity.id}/draw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token'
      },
      body: JSON.stringify({ count: 1 })
    });
    assert.equal(drawResponse.status, 200);

    const tokenCall = calls.find(item => item.path === '/token');
    const sendCall = calls.find(item => item.path === '/send');
    assert.equal(JSON.parse(tokenCall.body).appid, 'wxexampleappid0001');
    assert.equal(sendCall.query.access_token, 'access-token');
    const message = JSON.parse(sendCall.body);
    assert.equal(message.touser, 'openid_notice_member');
    assert.equal(message.template_id, 'draw-template');
    assert.equal(message.data.thing10.value, 'Message prize');
    assert.equal(message.data.thing2.value, 'Message prize');
    assert.equal(message.data.thing4.value, '恭喜中奖');
    assert.match(message.data.time7.value, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.equal(message.data.thing1.value, '请进入小程序查看详情');

    const runtimeDb = JSON.parse(await readFile(path.join(server.dataDir, 'db.json'), 'utf8'));
    assert.ok(runtimeDb.subscriptions[0].sentAt);
    assert.equal(runtimeDb.notificationLogs[0].status, 'sent');

    const messagesResponse = await fetch(`${server.baseUrl}/api/me/messages`, { headers });
    const messages = (await messagesResponse.json()).data;
    assert.equal(messages.length, 1);
    assert.equal(messages[0].activityId, activity.id);
    assert.equal(messages[0].status, 'sent');
    assert.match(messages[0].content, /开奖结果已发送/);
  } finally {
    await server.stop();
    await external.close();
  }
});

test('sends a configured draw reminder during the reminder lead window', async () => {
  const calls = [];
  const external = await startCode2SessionMock((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      calls.push({ path: url.pathname, body });
      res.setHeader('Content-Type', 'application/json');
      if (url.pathname === '/sns/jscode2session') {
        res.end(JSON.stringify({ openid: 'openid_draw_reminder', session_key: 'session_draw_reminder' }));
        return;
      }
      if (url.pathname === '/token') {
        res.end(JSON.stringify({ access_token: 'reminder-access-token', expires_in: 7200 }));
        return;
      }
      if (url.pathname === '/send') {
        res.end(JSON.stringify({ errcode: 0, msgid: 34567 }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ errcode: 404 }));
    });
  });
  const origin = new URL(external.url).origin;
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'reminder-secret',
    WECHAT_CODE2SESSION_URL: external.url,
    WECHAT_ACCESS_TOKEN_URL: `${origin}/token`,
    WECHAT_SUBSCRIBE_SEND_URL: `${origin}/send`,
    WECHAT_DRAW_REMINDER_TEMPLATE_ID: 'draw-reminder-template',
    WECHAT_DRAW_REMINDER_TEMPLATE_DATA: JSON.stringify({
      thing1: { value: '{{activityTitle}}' },
      time2: { value: '{{drawAt}}' },
      thing3: { value: '{{reminderText}}' }
    }),
    DRAW_REMINDER_LEAD_MS: '10000',
    DRAW_SCHEDULER_INTERVAL_MS: '1000'
  });

  try {
    const login = await loginTestUser(server.baseUrl, 'draw-reminder');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${login.sessionId}`
    };
    const createResponse = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prizeName: 'Reminder prize',
        prizeQuantity: 1,
        drawMode: 'time',
        drawAt: new Date(Date.now() + 8_000).toISOString()
      })
    });
    const activity = (await createResponse.json()).data;
    const subscriptionResponse = await fetch(`${server.baseUrl}/api/me/subscriptions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ activityId: activity.id, type: 'draw' })
    });
    assert.equal(subscriptionResponse.status, 200);

    for (let attempt = 0; attempt < 8 && !calls.some(item => item.path === '/send'); attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const sendCall = calls.find(item => item.path === '/send');
    assert.ok(sendCall);
    const message = JSON.parse(sendCall.body);
    assert.equal(message.template_id, 'draw-reminder-template');
    assert.equal(message.data.thing1.value, 'Reminder prize');
    assert.match(message.data.time2.value, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.match(message.data.thing3.value, /开奖/);

    const runtimeDb = JSON.parse(await readFile(path.join(server.dataDir, 'db.json'), 'utf8'));
    const subscription = runtimeDb.subscriptions.find(item => item.type === 'draw_reminder');
    assert.ok(subscription.sentAt);
    assert.equal(runtimeDb.notificationLogs[0].type, 'draw_reminder');
  } finally {
    await server.stop();
    await external.close();
  }
});

test('uses an explicit cash template only after a red-packet winner is selected', async () => {
  const calls = [];
  const external = await startCode2SessionMock((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      calls.push({ path: url.pathname, body });
      res.setHeader('Content-Type', 'application/json');
      if (url.pathname === '/sns/jscode2session') {
        res.end(JSON.stringify({ openid: 'openid_cash_notice', session_key: 'session_cash_notice' }));
        return;
      }
      if (url.pathname === '/token') {
        res.end(JSON.stringify({ access_token: 'cash-access-token', expires_in: 7200 }));
        return;
      }
      if (url.pathname === '/send') {
        res.end(JSON.stringify({ errcode: 0, msgid: 67890 }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ errcode: 404 }));
    });
  });
  const origin = new URL(external.url).origin;
  const server = await startServer({
    ADMIN_TOKEN: 'cash-admin-token',
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'cash-secret',
    WECHAT_CODE2SESSION_URL: external.url,
    WECHAT_ACCESS_TOKEN_URL: `${origin}/token`,
    WECHAT_SUBSCRIBE_SEND_URL: `${origin}/send`,
    WECHAT_DRAW_TEMPLATE_ID: 'shared-draw-template',
    WECHAT_DRAW_TEMPLATE_DATA: JSON.stringify({
      thing10: { value: '{{activityTitle}}' },
      thing2: { value: '{{prizeName}}' },
      thing4: { value: '{{result}}' },
      time7: { value: '{{drawAt}}' }
    }),
    WECHAT_CASH_TEMPLATE_ID: 'cash-template',
    WECHAT_CASH_TEMPLATE_DATA: JSON.stringify({
      date1: { value: '{{cashReceivedAt}}' },
      thing4: { value: '{{cashDescription}}' },
      amount5: { value: '{{cashAmount}}' }
    }),
    DRAW_SCHEDULER_INTERVAL_MS: '1000'
  });

  try {
    const login = await loginTestUser(server.baseUrl, 'cash-notice');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${login.sessionId}`
    };
    const createResponse = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prizes: [{ name: '现金提醒奖品', quantity: 1, type: '红包', faceValue: 66 }],
        drawMode: 'time',
        drawAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        homePlacement: 'cash'
      })
    });
    const activity = (await createResponse.json()).data;
    const joinResponse = await fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    assert.equal(joinResponse.status, 200);
    const subscriptionResponse = await fetch(`${server.baseUrl}/api/me/subscriptions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ activityId: activity.id, type: 'cash' })
    });
    assert.equal(subscriptionResponse.status, 200);
    const subscribedDetailResponse = await fetch(`${server.baseUrl}/api/activities/${activity.id}`, { headers });
    const subscribedDetail = (await subscribedDetailResponse.json()).data;
    assert.equal(subscribedDetail.reminderEnabled, true);

    const drawResponse = await fetch(`${server.baseUrl}/api/admin/activities/${activity.id}/draw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer cash-admin-token'
      },
      body: JSON.stringify({ count: 1 })
    });
    assert.equal(drawResponse.status, 200);
    for (let attempt = 0; attempt < 6 && !calls.some(item => item.path === '/send'); attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const sendCall = calls.find(item => item.path === '/send');
    assert.ok(sendCall);
    const message = JSON.parse(sendCall.body);
    assert.equal(message.template_id, 'cash-template');
    assert.match(message.data.date1.value, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.equal(message.data.thing4.value, '现金提醒奖品');
    assert.equal(message.data.amount5.value, '66.00');

    const detailResponse = await fetch(`${server.baseUrl}/api/activities/${activity.id}`, { headers });
    const detail = (await detailResponse.json()).data;
    assert.equal(detail.status, 'drawn');
    assert.equal(detail.winners.length, 1);
    assert.equal(detail.reminderEnabled, false);
    const runtimeDb = JSON.parse(await readFile(path.join(server.dataDir, 'db.json'), 'utf8'));
    assert.equal(runtimeDb.subscriptions.find(item => item.type === 'cash').attemptCount, 1);
    assert.ok(runtimeDb.subscriptions.find(item => item.type === 'cash').sentAt);
  } finally {
    await server.stop();
    await external.close();
  }
});

test('retries a failed draw subscription and records both delivery attempts', async () => {
  let sendAttempts = 0;
  const external = await startCode2SessionMock((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    req.resume();
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (url.pathname === '/sns/jscode2session') {
        res.end(JSON.stringify({ openid: 'openid_retry_notice', session_key: 'session_retry_notice' }));
        return;
      }
      if (url.pathname === '/token') {
        res.end(JSON.stringify({ access_token: 'retry-access-token', expires_in: 7200 }));
        return;
      }
      if (url.pathname === '/send') {
        sendAttempts += 1;
        res.end(JSON.stringify(sendAttempts === 1
          ? { errcode: 45009, errmsg: 'rate limit' }
          : { errcode: 0, msgid: 24680 }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ errcode: 404 }));
    });
  });
  const origin = new URL(external.url).origin;
  const server = await startServer({
    ADMIN_TOKEN: 'admin-token',
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'retry-secret',
    WECHAT_CODE2SESSION_URL: external.url,
    WECHAT_ACCESS_TOKEN_URL: `${origin}/token`,
    WECHAT_SUBSCRIBE_SEND_URL: `${origin}/send`,
    WECHAT_DRAW_TEMPLATE_ID: 'retry-template',
    WECHAT_DRAW_TEMPLATE_DATA: JSON.stringify({
      thing10: { value: '{{activityTitle}}' },
      thing2: { value: '{{prizeName}}' },
      thing4: { value: '{{result}}' },
      time7: { value: '{{drawAt}}' }
    }),
    DRAW_SCHEDULER_INTERVAL_MS: '1000',
    NOTIFICATION_RETRY_DELAYS_MS: '1000',
    NOTIFICATION_MAX_ATTEMPTS: '3'
  });

  try {
    const login = await loginTestUser(server.baseUrl, 'retry-notice');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${login.sessionId}`
    };
    const activity = await createTestActivity(server.baseUrl, login.sessionId);
    const joinResponse = await fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
      method: 'POST',
      headers,
      body: '{}'
    });
    assert.equal(joinResponse.status, 200);
    const subscriptionResponse = await fetch(`${server.baseUrl}/api/me/subscriptions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ activityId: activity.id, type: 'draw_result' })
    });
    assert.equal(subscriptionResponse.status, 200);
    const drawResponse = await fetch(`${server.baseUrl}/api/admin/activities/${activity.id}/draw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer admin-token'
      },
      body: JSON.stringify({ count: 1 })
    });
    assert.equal(drawResponse.status, 200);
    assert.equal(sendAttempts, 1);

    for (let attempt = 0; attempt < 8 && sendAttempts < 2; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.equal(sendAttempts, 2);
    const runtimeDb = JSON.parse(await readFile(path.join(server.dataDir, 'db.json'), 'utf8'));
    const subscription = runtimeDb.subscriptions.find(item => item.activityId === activity.id);
    assert.equal(subscription.attemptCount, 2);
    assert.ok(subscription.sentAt);
    assert.deepEqual(
      runtimeDb.notificationLogs
        .filter(item => item.subscriptionId === subscription.id)
        .map(item => item.status)
        .sort(),
      ['failed', 'sent']
    );
  } finally {
    await server.stop();
    await external.close();
  }
});

test('selects recent creator lotteries and blocks only their real winners', async () => {
  const code2session = await startCode2SessionMock((req, res) => {
    const code = new URL(req.url, 'http://127.0.0.1').searchParams.get('js_code') || 'member';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ openid: `openid_recent_${code}`, session_key: `session_${code}` }));
  });
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'recent-winner-secret',
    WECHAT_CODE2SESSION_URL: code2session.url
  });

  const requestJson = async (pathname, { method = 'GET', token = '', data } = {}) => {
    const response = await fetch(`${server.baseUrl}${pathname}`, {
      method,
      headers: {
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    return { response, payload: await response.json() };
  };

  try {
    const owner = await loginTestUser(server.baseUrl, 'owner');
    const winner = await loginTestUser(server.baseUrl, 'winner');
    const newcomer = await loginTestUser(server.baseUrl, 'newcomer');
    const outsider = await loginTestUser(server.baseUrl, 'outsider');
    const historical = await requestJson('/api/activities', {
      method: 'POST',
      token: owner.sessionId,
      data: {
        prizes: [{ name: '历史中奖奖品', quantity: 1, type: '奖品' }],
        drawMode: 'time',
        drawAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      }
    });
    assert.equal(historical.response.status, 200, historical.payload.msg);
    const historicalId = historical.payload.data.id;
    const joined = await requestJson(`/api/activities/${historicalId}/join`, {
      method: 'POST',
      token: winner.sessionId,
      data: {}
    });
    assert.equal(joined.response.status, 200, joined.payload.msg);
    const drawn = await requestJson(`/api/admin/activities/${historicalId}/draw`, {
      method: 'POST',
      data: { count: 1 }
    });
    assert.equal(drawn.response.status, 200, drawn.payload.msg);

    const ownerRecent = await requestJson('/api/me/activities/recent-ended', { token: owner.sessionId });
    assert.equal(ownerRecent.response.status, 200);
    assert.deepEqual(ownerRecent.payload.data.activities.map(item => item.id), [historicalId]);
    assert.equal(ownerRecent.payload.data.activities[0].winnerCount, 1);
    const outsiderRecent = await requestJson('/api/me/activities/recent-ended', { token: outsider.sessionId });
    assert.deepEqual(outsiderRecent.payload.data.activities, []);

    const invalidRange = await requestJson('/api/activities', {
      method: 'POST',
      token: owner.sessionId,
      data: {
        prizes: [{ name: '无效范围测试', quantity: 1, type: '奖品' }],
        drawMode: 'time',
        drawAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        advanced: { enabled: true, recentWinnerBlock: true, recentWinnerActivityIds: ['act_not_owned'] }
      }
    });
    assert.equal(invalidRange.response.status, 400);

    const protectedActivity = await requestJson('/api/activities', {
      method: 'POST',
      token: owner.sessionId,
      data: {
        prizes: [{ name: '限制近期中奖者奖品', quantity: 2, type: '奖品' }],
        drawMode: 'time',
        drawAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        advanced: {
          enabled: true,
          recentWinnerBlock: true,
          recentWinnerDays: 30,
          recentWinnerActivityIds: [historicalId]
        }
      }
    });
    assert.equal(protectedActivity.response.status, 200, protectedActivity.payload.msg);
    const protectedId = protectedActivity.payload.data.id;
    const blocked = await requestJson(`/api/activities/${protectedId}/join`, {
      method: 'POST',
      token: winner.sessionId,
      data: {}
    });
    assert.equal(blocked.response.status, 403);
    assert.match(blocked.payload.msg, /近期抽奖中中奖/);
    const allowed = await requestJson(`/api/activities/${protectedId}/join`, {
      method: 'POST',
      token: newcomer.sessionId,
      data: {}
    });
    assert.equal(allowed.response.status, 200, allowed.payload.msg);
  } finally {
    await server.stop();
    await code2session.close();
  }
});

test('registers a one-time comment subscription and notifies the activity creator', async () => {
  const calls = [];
  const external = await startCode2SessionMock((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      calls.push({ path: url.pathname, body });
      res.setHeader('Content-Type', 'application/json');
      if (url.pathname === '/sns/jscode2session') {
        const code = url.searchParams.get('js_code') || 'member';
        res.end(JSON.stringify({ openid: `openid_comment_${code}`, session_key: `session_${code}` }));
        return;
      }
      if (url.pathname === '/token') {
        res.end(JSON.stringify({ access_token: 'comment-access-token', expires_in: 7200 }));
        return;
      }
      if (url.pathname === '/send') {
        res.end(JSON.stringify({ errcode: 0, msgid: 67890 }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ errcode: 404 }));
    });
  });
  const origin = new URL(external.url).origin;
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'comment-secret',
    WECHAT_CODE2SESSION_URL: external.url,
    WECHAT_ACCESS_TOKEN_URL: `${origin}/token`,
    WECHAT_SUBSCRIBE_SEND_URL: `${origin}/send`,
    WECHAT_COMMENT_TEMPLATE_ID: 'comment-template',
    WECHAT_COMMENT_TEMPLATE_DATA: JSON.stringify({
      thing1: { value: '{{activityTitle}}' },
      thing2: { value: '{{commenterName}}' },
      thing3: { value: '{{commentContent}}' },
      time4: { value: '{{commentAt}}' }
    })
  });

  try {
    const owner = await loginTestUser(server.baseUrl, 'owner');
    const guest = await loginTestUser(server.baseUrl, 'guest');
    const ownerHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${owner.sessionId}` };
    const guestHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${guest.sessionId}` };
    const createResponse = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        prizes: [{ name: '留言通知奖品', quantity: 1, type: '奖品' }],
        drawMode: 'time',
        drawAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        advanced: { enabled: true, comments: true }
      })
    });
    const activity = (await createResponse.json()).data;
    const subscribeResponse = await fetch(`${server.baseUrl}/api/me/subscriptions`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ type: 'comment', activityId: activity.id })
    });
    assert.equal(subscribeResponse.status, 200);

    for (const content of ['第一条真实留言', '第二条真实留言']) {
      const commentResponse = await fetch(`${server.baseUrl}/api/activities/${activity.id}/comments`, {
        method: 'POST',
        headers: guestHeaders,
        body: JSON.stringify({ content })
      });
      assert.equal(commentResponse.status, 200);
    }
    const sendCalls = calls.filter(item => item.path === '/send');
    assert.equal(sendCalls.length, 1);
    const message = JSON.parse(sendCalls[0].body);
    assert.equal(message.touser, 'openid_comment_owner');
    assert.equal(message.template_id, 'comment-template');
    assert.equal(message.data.thing1.value, '留言通知奖品');
    assert.equal(message.data.thing2.value, '微信用户');
    assert.equal(message.data.thing3.value, '第一条真实留言');
    assert.match(message.data.time4.value, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.match(message.page, new RegExp(`pages/detail/detail\\?id=${activity.id}`));

    const runtimeDb = JSON.parse(await readFile(path.join(server.dataDir, 'db.json'), 'utf8'));
    const subscription = runtimeDb.subscriptions.find(item => item.type === 'comment');
    assert.ok(subscription.sentAt);
    assert.equal(runtimeDb.notificationLogs.filter(item => item.subscriptionId === subscription.id).length, 1);
  } finally {
    await server.stop();
    await external.close();
  }
});

test('persists addresses and completes the withdrawal review lifecycle', async () => {
  const code2session = await startCode2SessionMock((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ openid: 'openid_wallet_member', session_key: 'session_wallet_member' }));
  });
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'test-secret',
    WECHAT_CODE2SESSION_URL: code2session.url
  });

  try {
    const loginResponse = await fetch(`${server.baseUrl}/api/auth/wechat-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'wallet-member', nickname: 'Wallet member' })
    });
    const login = (await loginResponse.json()).data;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${login.sessionId}`
    };

    const address = {
      userName: '测试用户',
      telNumber: '13800000000',
      provinceName: '上海市',
      cityName: '上海市',
      countyName: '浦东新区',
      detailInfo: '测试路 1 号'
    };
    const saveAddress = await fetch(`${server.baseUrl}/api/me/address`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(address)
    });
    assert.equal(saveAddress.status, 200);
    const addressResponse = await fetch(`${server.baseUrl}/api/me/address`, { headers });
    assert.deepEqual((await addressResponse.json()).data, { ...address, postalCode: '' });

    const dbPath = path.join(server.dataDir, 'db.json');
    const runtimeDb = JSON.parse(await readFile(dbPath, 'utf8'));
    runtimeDb.wallet.records.unshift({
      id: 'wallet_credit_test',
      memberOpenid: 'openid_wallet_member',
      title: '测试红包入账',
      amount: 25,
      status: 'completed',
      createdAt: new Date().toISOString()
    });
    await writeFile(dbPath, JSON.stringify(runtimeDb, null, 2), 'utf8');

    const withdrawalResponse = await fetch(`${server.baseUrl}/api/me/withdrawals`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ amount: 10 })
    });
    assert.equal(withdrawalResponse.status, 200);
    const withdrawal = (await withdrawalResponse.json()).data.record;
    assert.equal(withdrawal.status, 'pending');

    const walletAfterRequest = (await (await fetch(`${server.baseUrl}/api/me/wallet`, { headers })).json()).data;
    assert.equal(walletAfterRequest.balance, 15);
    assert.equal(walletAfterRequest.frozen, 10);

    const adminList = (await (await fetch(`${server.baseUrl}/api/admin/withdrawals`)).json()).data;
    assert.equal(adminList[0].id, withdrawal.id);
    const rejectResponse = await fetch(`${server.baseUrl}/api/admin/withdrawals/${withdrawal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' })
    });
    assert.equal(rejectResponse.status, 200);

    const walletAfterReject = (await (await fetch(`${server.baseUrl}/api/me/wallet`, { headers })).json()).data;
    assert.equal(walletAfterReject.balance, 25);
    assert.equal(walletAfterReject.frozen, 0);

    const logoutResponse = await fetch(`${server.baseUrl}/api/auth/logout`, { method: 'POST', headers });
    assert.equal(logoutResponse.status, 200);
    const overviewAfterLogout = (await (await fetch(`${server.baseUrl}/api/me/overview`, { headers })).json()).data;
    assert.equal(overviewAfterLogout.authenticated, false);
  } finally {
    await server.stop();
    await code2session.close();
  }
});

test('enforces region and survey conditions, reviews applications, and applies capped assist weight', async () => {
  const codeMock = await startCode2SessionMock((req, res) => {
    const code = new URL(req.url, 'http://localhost').searchParams.get('js_code') || 'user';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      openid: `openid_${code}`,
      unionid: `unionid_${code}`,
      session_key: Buffer.alloc(16, code.length).toString('base64')
    }));
  });
  const server = await startServer({
    WECHAT_APP_SECRET: 'condition-test-secret',
    WECHAT_CODE2SESSION_URL: codeMock.url
  });
  try {
    const owner = await loginTestUser(server.baseUrl, 'owner');
    const applicant = await loginTestUser(server.baseUrl, 'applicant');
    const helper = await loginTestUser(server.baseUrl, 'helper');
    const invalidPeopleDraw = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner.sessionId}`
      },
      body: JSON.stringify({
        prizes: [{ name: '双份奖品', quantity: 2, type: '奖品' }],
        drawMode: 'people',
        drawParticipantTarget: 1,
        drawAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        conditions: {}
      })
    });
    assert.equal(invalidPeopleDraw.status, 400);

    const invalidInstantAssist = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner.sessionId}`
      },
      body: JSON.stringify({
        prizes: [{ name: '即时奖品', quantity: 1, type: '奖品' }],
        drawMode: 'instant',
        drawAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        conditions: { assist: true }
      })
    });
    assert.equal(invalidInstantAssist.status, 400);

    const question = { id: 'question_1', title: '请输入门店名称', required: true };
    const activity = await createTestActivity(server.baseUrl, owner.sessionId, {
      assist: true,
      assistWeight: 2,
      assistLimit: 1,
      review: true,
      region: true,
      regionConfig: {
        name: '上海中心区域',
        latitude: 31.2304,
        longitude: 121.4737,
        radiusMeters: 1500
      },
      survey: true,
      surveyQuestions: [question]
    });
    const join = body => fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${applicant.sessionId}`
      },
      body: JSON.stringify(body)
    });

    const missingLocation = await join({ surveyAnswers: [{ questionId: question.id, value: '人民广场店' }] });
    assert.equal(missingLocation.status, 400);

    const outside = await join({
      location: { latitude: 39.9042, longitude: 116.4074 },
      surveyAnswers: [{ questionId: question.id, value: '人民广场店' }]
    });
    assert.equal(outside.status, 403);

    const missingSurvey = await join({ location: { latitude: 31.2305, longitude: 121.4738 } });
    assert.equal(missingSurvey.status, 400);

    const pending = await join({
      location: { latitude: 31.2305, longitude: 121.4738 },
      surveyAnswers: [{ questionId: question.id, value: '人民广场店' }]
    });
    assert.equal(pending.status, 200);
    assert.equal((await pending.json()).data.pending, true);

    const pendingDetail = await fetch(`${server.baseUrl}/api/activities/${activity.id}`, {
      headers: { Authorization: `Bearer ${applicant.sessionId}` }
    });
    const pendingActivity = (await pendingDetail.json()).data;
    assert.equal(pendingActivity.joinStatus, 'pending');
    assert.equal(pendingActivity.metrics.participantCount, 0);

    const adminActivities = await fetch(`${server.baseUrl}/api/admin/activities`);
    const adminActivity = (await adminActivities.json()).data.find(item => item.id === activity.id);
    const application = adminActivity.participationApplications.find(item => item.memberOpenid === 'openid_applicant');
    assert.equal(application.surveyAnswers[0].value, '人民广场店');
    assert.ok(application.location.distanceMeters < 100);

    const approve = await fetch(`${server.baseUrl}/api/admin/participation-applications/${application.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' })
    });
    assert.equal(approve.status, 200);

    const joinedDetail = await fetch(`${server.baseUrl}/api/activities/${activity.id}`, {
      headers: { Authorization: `Bearer ${applicant.sessionId}` }
    });
    const joinedActivity = (await joinedDetail.json()).data;
    assert.equal(joinedActivity.joinStatus, 'joined');
    assert.equal(joinedActivity.metrics.participantCount, 1);
    assert.ok(joinedActivity.participantId);

    const assist = () => fetch(`${server.baseUrl}/api/activities/${activity.id}/assist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${helper.sessionId}`
      },
      body: JSON.stringify({ targetParticipantId: joinedActivity.participantId })
    });
    const firstAssist = await assist();
    const firstAssistPayload = await firstAssist.json();
    assert.equal(firstAssistPayload.data.assisted, true);
    assert.equal(firstAssistPayload.data.effectiveAssistCount, 1);
    assert.equal(firstAssistPayload.data.drawWeight, 3);
    const duplicateAssist = await assist();
    const duplicatePayload = await duplicateAssist.json();
    assert.equal(duplicatePayload.data.assisted, false);
    assert.equal(duplicatePayload.data.assistCount, 1);
    assert.equal(duplicatePayload.data.drawWeight, 3);

    const assistedDraw = await fetch(`${server.baseUrl}/api/admin/activities/${activity.id}/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 1 })
    });
    const assistedWinners = (await assistedDraw.json()).data;
    assert.equal(assistedDraw.status, 200);
    assert.equal(assistedWinners[0].selectionWeight, 3);
  } finally {
    await server.stop();
    await codeMock.close();
  }
});

test('runs a post-participation check-in task and applies its server-verified reward weight', async () => {
  const codeMock = await startCode2SessionMock((req, res) => {
    const code = new URL(req.url, 'http://localhost').searchParams.get('js_code') || 'member';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      openid: `openid_checkin_${code}`,
      session_key: Buffer.alloc(16, code.length || 1).toString('base64')
    }));
  });
  const server = await startServer({
    WECHAT_APP_SECRET: 'check-in-test-secret',
    WECHAT_CODE2SESSION_URL: codeMock.url,
    CHECK_IN_TASK_MIN_DURATION_MS: '20'
  });
  try {
    const owner = await loginTestUser(server.baseUrl, 'owner');
    const guest = await loginTestUser(server.baseUrl, 'guest');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${owner.sessionId}`
    };
    const checkInTask = {
      type: 'timed',
      title: '浏览活动说明',
      durationSeconds: 15,
      guideText: '阅读活动说明后完成打卡。',
      rewardMode: 'fixed',
      rewardMin: 3,
      rewardMax: 3
    };
    const invalidInstant = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prizes: [{ name: '即时打卡奖品', quantity: 1, type: '奖品' }],
        drawMode: 'instant',
        drawAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        conditions: { checkIn: true, checkInTask }
      })
    });
    assert.equal(invalidInstant.status, 400);

    const activity = await createTestActivity(server.baseUrl, owner.sessionId, {
      checkIn: true,
      checkInTask
    });
    assert.equal(activity.conditions.checkIn, true);
    assert.equal(activity.conditions.checkInTask.type, 'timed');
    assert.equal(activity.conditions.checkInTask.title, checkInTask.title);
    assert.equal(activity.conditions.checkInTask.miniProgramLink, undefined);

    const guestHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${guest.sessionId}`
    };
    const checkInStart = () => fetch(`${server.baseUrl}/api/activities/${activity.id}/check-in/start`, {
      method: 'POST', headers: guestHeaders, body: '{}'
    });
    const checkInComplete = () => fetch(`${server.baseUrl}/api/activities/${activity.id}/check-in/complete`, {
      method: 'POST', headers: guestHeaders, body: '{}'
    });

    assert.equal((await checkInStart()).status, 403);
    const join = await fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
      method: 'POST', headers: guestHeaders, body: '{}'
    });
    assert.equal(join.status, 200);

    const started = await checkInStart();
    const startedPayload = await started.json();
    assert.equal(started.status, 200, startedPayload.msg);
    assert.equal(startedPayload.data.status, 'started');
    assert.equal(startedPayload.data.bonusWeight, 1);
    assert.equal(startedPayload.data.task.title, checkInTask.title);

    assert.equal((await checkInComplete()).status, 409);
    await new Promise(resolve => setTimeout(resolve, 30));
    const completed = await checkInComplete();
    const completedPayload = await completed.json();
    assert.equal(completed.status, 200, completedPayload.msg);
    assert.equal(completedPayload.data.status, 'completed');
    assert.equal(completedPayload.data.bonusWeight, 3);

    const detail = await fetch(`${server.baseUrl}/api/activities/${activity.id}`, {
      headers: { Authorization: `Bearer ${guest.sessionId}` }
    });
    const detailPayload = await detail.json();
    assert.equal(detailPayload.data.checkInProgress.status, 'completed');
    assert.equal(detailPayload.data.drawWeight, 3);

    const draw = await fetch(`${server.baseUrl}/api/admin/activities/${activity.id}/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 1 })
    });
    const drawPayload = await draw.json();
    assert.equal(draw.status, 200, drawPayload.msg);
    assert.equal(drawPayload.data[0].selectionWeight, 3);
  } finally {
    await server.stop();
    await codeMock.close();
  }
});

test('verifies official-account followers through the signed WeChat callback', async () => {
  const callbackToken = 'official-callback-token';
  const mock = await startCode2SessionMock((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/stable-token') {
      res.end(JSON.stringify({ access_token: 'official-access-token', expires_in: 7200 }));
      return;
    }
    if (url.pathname === '/official-user') {
      res.end(JSON.stringify({ subscribe: 1, openid: 'oa_follower', unionid: 'unionid_follower' }));
      return;
    }
    const code = url.searchParams.get('js_code') || 'user';
    res.end(JSON.stringify({
      openid: `openid_${code}`,
      unionid: `unionid_${code}`,
      session_key: Buffer.alloc(16, code.length).toString('base64')
    }));
  });
  const origin = new URL(mock.url).origin;
  const server = await startServer({
    WECHAT_APP_SECRET: 'official-test-mini-secret',
    WECHAT_CODE2SESSION_URL: mock.url,
    OFFICIAL_ACCOUNT_APPID: 'wx_official_test',
    OFFICIAL_ACCOUNT_APP_SECRET: 'official-test-secret',
    OFFICIAL_ACCOUNT_TOKEN: callbackToken,
    OFFICIAL_ACCOUNT_NAME: '测试公众号',
    OFFICIAL_ACCOUNT_ACCESS_TOKEN_URL: `${origin}/stable-token`,
    OFFICIAL_ACCOUNT_USER_INFO_URL: `${origin}/official-user`
  });
  try {
    const owner = await loginTestUser(server.baseUrl, 'owner');
    const follower = await loginTestUser(server.baseUrl, 'follower');
    const activity = await createTestActivity(server.baseUrl, owner.sessionId, { fansOnly: true });
    const join = () => fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${follower.sessionId}`
      },
      body: '{}'
    });
    assert.equal((await join()).status, 403);

    const timestamp = '1720000000';
    const nonce = 'callback-nonce';
    const signature = crypto.createHash('sha1').update([callbackToken, timestamp, nonce].sort().join('')).digest('hex');
    const verify = await fetch(`${server.baseUrl}/api/wechat/official-account/callback?timestamp=${timestamp}&nonce=${nonce}&signature=${signature}&echostr=verified`);
    assert.equal(await verify.text(), 'verified');

    const callback = await fetch(`${server.baseUrl}/api/wechat/official-account/callback?timestamp=${timestamp}&nonce=${nonce}&signature=${signature}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: '<xml><ToUserName><![CDATA[gh_test]]></ToUserName><FromUserName><![CDATA[oa_follower]]></FromUserName><CreateTime>1720000000</CreateTime><MsgType><![CDATA[event]]></MsgType><Event><![CDATA[subscribe]]></Event></xml>'
    });
    assert.equal(callback.status, 200);
    assert.equal(await callback.text(), 'success');
    assert.equal((await join()).status, 200);

    const integrations = await fetch(`${server.baseUrl}/api/admin/integrations`);
    assert.equal((await integrations.json()).data.officialAccount.followerCount, 1);
  } finally {
    await server.stop();
    await mock.close();
  }
});

test('authorizes a creator-owned official account through the WeChat open-platform flow', async () => {
  const componentAppId = 'wx_component_test';
  const componentToken = 'component-message-token';
  const componentAesKey = crypto.randomBytes(32).toString('base64').slice(0, 43);
  const openApiPort = await freePort();
  const openApi = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/cgi-bin/component/api_component_token')) {
      return res.end(JSON.stringify({ component_access_token: 'component_access', expires_in: 7200 }));
    }
    if (req.url.startsWith('/cgi-bin/component/api_create_preauthcode')) {
      return res.end(JSON.stringify({ pre_auth_code: 'pre_auth_test', expires_in: 600 }));
    }
    if (req.url.startsWith('/cgi-bin/component/api_query_auth')) {
      return res.end(JSON.stringify({
        authorization_info: {
          authorizer_appid: 'wx_authorized_account',
          authorizer_access_token: 'authorizer_access',
          expires_in: 7200,
          authorizer_refresh_token: 'authorizer_refresh',
          func_info: [{ funcscope_category: { id: 1 } }]
        }
      }));
    }
    if (req.url.startsWith('/cgi-bin/component/api_get_authorizer_info')) {
      return res.end(JSON.stringify({
        authorizer_info: {
          nick_name: '已授权公众号',
          user_name: 'gh_authorized',
          principal_name: '测试主体',
          head_img: 'https://example.test/avatar.png',
          service_type_info: { id: 2 },
          verify_type_info: { id: 0 }
        }
      }));
    }
    if (req.url.startsWith('/cgi-bin/user/info')) {
      return res.end(JSON.stringify({
        subscribe: 1,
        openid: 'authorized_follower',
        unionid: 'unionid_open_guest'
      }));
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ errcode: 404, errmsg: 'not found' }));
  });
  await new Promise((resolve, reject) => {
    openApi.once('error', reject);
    openApi.listen(openApiPort, '127.0.0.1', resolve);
  });
  const code2session = await startCode2SessionMock((req, res) => {
    const code = new URL(req.url, 'http://127.0.0.1').searchParams.get('js_code');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ openid: `openid_${code}`, unionid: `unionid_${code}`, session_key: `session_${code}` }));
  });
  const server = await startServer({
    WECHAT_APP_SECRET: 'mini-secret',
    WECHAT_CODE2SESSION_URL: code2session.url,
    WECHAT_OPEN_COMPONENT_APPID: componentAppId,
    WECHAT_OPEN_COMPONENT_APP_SECRET: 'component-secret',
    WECHAT_OPEN_COMPONENT_TOKEN: componentToken,
    WECHAT_OPEN_COMPONENT_AES_KEY: componentAesKey,
    WECHAT_OPEN_API_BASE_URL: `http://127.0.0.1:${openApiPort}`,
    WECHAT_OPEN_AUTH_PAGE_URL: 'https://mp.weixin.qq.com/cgi-bin/componentloginpage',
    WECHAT_OPEN_PUBLIC_BASE_URL: 'https://lottery.test',
    WECHAT_OPEN_AUTH_REDIRECT_URL: 'https://lottery.test/api/wechat/open-platform/authorization/callback',
    WECHAT_OPEN_USER_INFO_URL: `http://127.0.0.1:${openApiPort}/cgi-bin/user/info`
  });
  try {
    const owner = await loginTestUser(server.baseUrl, 'open_owner');
    const guest = await loginTestUser(server.baseUrl, 'open_guest');
    const beforeTicket = await fetch(`${server.baseUrl}/api/integrations/official-accounts/authorization`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner.sessionId}` }
    });
    assert.equal(beforeTicket.status, 409);

    const ticketCallback = encryptWechatOpenCallback({
      appid: componentAppId,
      token: componentToken,
      aesKey: componentAesKey,
      messageXml: '<xml><AppId>wx_component_test</AppId><InfoType>component_verify_ticket</InfoType><ComponentVerifyTicket>verify_ticket_test</ComponentVerifyTicket></xml>'
    });
    const ticketResponse = await fetch(`${server.baseUrl}/api/wechat/open-platform/component/callback?${ticketCallback.query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: ticketCallback.body
    });
    assert.equal(ticketResponse.status, 200);
    assert.equal(await ticketResponse.text(), 'success');

    const authorizationResponse = await fetch(`${server.baseUrl}/api/integrations/official-accounts/authorization`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner.sessionId}` }
    });
    assert.equal(authorizationResponse.status, 200);
    const authorization = (await authorizationResponse.json()).data;
    const relayUrl = new URL(authorization.url);
    const state = relayUrl.searchParams.get('state');
    assert.ok(state);

    const relayResponse = await fetch(`${server.baseUrl}/wechat/official-account/authorize?state=${encodeURIComponent(state)}`, {
      redirect: 'manual'
    });
    assert.equal(relayResponse.status, 302);
    const providerUrl = new URL(relayResponse.headers.get('location'));
    assert.equal(providerUrl.searchParams.get('component_appid'), componentAppId);
    assert.equal(providerUrl.searchParams.get('pre_auth_code'), 'pre_auth_test');
    assert.match(providerUrl.searchParams.get('redirect_uri'), /state=/);

    const callbackResponse = await fetch(`${server.baseUrl}/api/wechat/open-platform/authorization/callback?auth_code=authorization_code_test&state=${encodeURIComponent(state)}`);
    assert.equal(callbackResponse.status, 200);
    assert.match(await callbackResponse.text(), /公众号授权成功/);

    const listResponse = await fetch(`${server.baseUrl}/api/integrations/official-accounts`, {
      headers: { Authorization: `Bearer ${owner.sessionId}` }
    });
    const accounts = (await listResponse.json()).data;
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].appid, 'wx_authorized_account');
    assert.equal(accounts[0].name, '已授权公众号');

    const ownerActivity = await createTestActivity(server.baseUrl, owner.sessionId, {
      fansOnly: true,
      officialAccountAppId: 'wx_authorized_account'
    });
    assert.equal(ownerActivity.conditions.officialAccountName, '已授权公众号');

    const followerCallback = encryptWechatOpenCallback({
      appid: componentAppId,
      token: componentToken,
      aesKey: componentAesKey,
      messageXml: '<xml><ToUserName>gh_authorized</ToUserName><FromUserName>authorized_follower</FromUserName><MsgType>event</MsgType><Event>subscribe</Event></xml>',
      timestamp: '1700000001',
      nonce: 'follower-nonce'
    });
    const followerResponse = await fetch(`${server.baseUrl}/api/wechat/open-platform/message/wx_authorized_account?${followerCallback.query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' },
      body: followerCallback.body
    });
    assert.equal(followerResponse.status, 200);
    const guestJoin = await fetch(`${server.baseUrl}/api/activities/${ownerActivity.id}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guest.sessionId}`
      },
      body: '{}'
    });
    assert.equal(guestJoin.status, 200);

    const guestActivity = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${guest.sessionId}`
      },
      body: JSON.stringify({
        prizes: [{ name: '越权测试奖品', quantity: 1, type: '奖品' }],
        drawMode: 'time',
        drawAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        conditions: { fansOnly: true, officialAccountAppId: 'wx_authorized_account' }
      })
    });
    assert.equal(guestActivity.status, 409);
  } finally {
    await server.stop();
    await code2session.close();
    await new Promise(resolve => openApi.close(resolve));
  }
});

test('syncs enterprise WeChat contacts before allowing participation', async () => {
  const mock = await startCode2SessionMock((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('Content-Type', 'application/json');
    if (url.pathname === '/cgi-bin/gettoken') {
      res.end(JSON.stringify({ errcode: 0, access_token: 'wecom-token', expires_in: 7200 }));
      return;
    }
    if (url.pathname.endsWith('/get_follow_user_list')) {
      res.end(JSON.stringify({ errcode: 0, follow_user: ['staff_1'] }));
      return;
    }
    if (url.pathname.endsWith('/externalcontact/list')) {
      res.end(JSON.stringify({ errcode: 0, external_userid: ['external_1'] }));
      return;
    }
    if (url.pathname.endsWith('/externalcontact/get')) {
      res.end(JSON.stringify({ errcode: 0, external_contact: { external_userid: 'external_1', unionid: 'unionid_customer', name: '测试客户' } }));
      return;
    }
    if (url.pathname.endsWith('/externalcontact/groupchat/list')) {
      res.end(JSON.stringify({ errcode: 0, group_chat_list: [{ chat_id: 'group_chat_1', status: 0 }], next_cursor: '' }));
      return;
    }
    if (url.pathname.endsWith('/externalcontact/groupchat/get')) {
      res.end(JSON.stringify({
        errcode: 0,
        group_chat: {
          chat_id: 'group_chat_1',
          name: '测试客户群',
          member_list: [{ userid: 'external_1', type: 2 }]
        }
      }));
      return;
    }
    const code = url.searchParams.get('js_code') || 'user';
    res.end(JSON.stringify({
      openid: `openid_${code}`,
      unionid: `unionid_${code}`,
      session_key: Buffer.alloc(16, code.length).toString('base64')
    }));
  });
  const server = await startServer({
    WECHAT_APP_SECRET: 'wecom-test-mini-secret',
    WECHAT_CODE2SESSION_URL: mock.url,
    WECOM_CORP_ID: 'corp_test',
    WECOM_CONTACT_SECRET: 'wecom-contact-secret',
    WECOM_NAME: '测试企业',
    WECOM_API_BASE_URL: new URL(mock.url).origin
  });
  try {
    const owner = await loginTestUser(server.baseUrl, 'owner');
    const customer = await loginTestUser(server.baseUrl, 'customer');
    const activity = await createTestActivity(server.baseUrl, owner.sessionId, { wecom: true });
    const join = () => fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer.sessionId}`
      },
      body: '{}'
    });
    assert.equal((await join()).status, 403);
    const sync = await fetch(`${server.baseUrl}/api/admin/integrations/wecom/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    assert.equal(sync.status, 200);
    const syncResult = (await sync.json()).data;
    assert.equal(syncResult.synced, 1);
    assert.equal(syncResult.groups, 1);
    assert.equal((await join()).status, 200);

    const groupsResponse = await fetch(`${server.baseUrl}/api/integrations/wecom/groups`, {
      headers: { Authorization: `Bearer ${owner.sessionId}` }
    });
    const groups = (await groupsResponse.json()).data;
    assert.equal(groups.length, 1);
    const groupActivity = await createTestActivity(server.baseUrl, owner.sessionId, {
      groupOnly: true,
      groupType: 'wecom',
      enterpriseId: groups[0].id,
      enterpriseName: groups[0].name
    });
    const groupJoin = await fetch(`${server.baseUrl}/api/activities/${groupActivity.id}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customer.sessionId}`
      },
      body: '{}'
    });
    assert.equal(groupJoin.status, 200);
  } finally {
    await server.stop();
    await mock.close();
  }
});

test('enforces supported extended participation rules and powers the new home and profile APIs', async () => {
  const code2session = await startCode2SessionMock((req, res) => {
    const code = new URL(req.url, 'http://localhost').searchParams.get('js_code') || 'member';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ openid: `openid_extended_${code}`, session_key: `session_${code}` }));
  });
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'extended-rules-secret',
    WECHAT_CODE2SESSION_URL: code2session.url,
    ADVANCED_FEATURE_PRICE_CENTS: '0',
    ACTIVITY_TASK_MIN_DURATION_MS: '20'
  });

  const jsonRequest = async (pathname, { method = 'GET', token = '', data } = {}) => {
    const response = await fetch(`${server.baseUrl}${pathname}`, {
      method,
      headers: {
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    return { response, payload: await response.json() };
  };

  try {
    const owner = await loginTestUser(server.baseUrl, 'owner');
    const guest = await loginTestUser(server.baseUrl, 'guest');
    const created = await jsonRequest('/api/activities', {
      method: 'POST',
      token: owner.sessionId,
      data: {
        prizes: [{ name: '真实高级条件奖品', quantity: 2, type: '奖品' }],
        drawMode: 'time',
        drawAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        templateType: '新样式',
        homePlacement: 'official',
        promotion: { platformRecommend: true },
        advanced: { enabled: true, analytics: true, comments: true },
        conditions: {
          task: true,
          taskText: '完成指定分享任务',
          taskProofRequired: true,
          answer: true,
          answerQuestion: '2 + 2 等于几',
          answerValue: '4',
          vote: true,
          voteQuestion: '请选择一种颜色',
          voteOptions: ['红色', '蓝色'],
          game: true,
          gameTarget: 3
        }
      }
    });
    assert.equal(created.response.status, 200, created.payload.msg);
    const activity = created.payload.data;
    assert.equal('passcode' in activity.conditions, false);
    assert.equal('checkIn' in activity.conditions, false);
    assert.equal('checkInTask' in activity.conditions, false);
    assert.equal(activity.conditions.answer, true);
    assert.equal('game' in activity.conditions, false);
    assert.equal('passcodeValue' in activity.conditions, false);
    assert.equal('answerValue' in activity.conditions, false);

    const removedGameEndpoint = await fetch(`${server.baseUrl}/api/activities/${activity.id}/game/start`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${guest.sessionId}` }
    });
    assert.equal(removedGameEndpoint.status, 404);

    const startedParticipationTask = await jsonRequest(`/api/activities/${activity.id}/task/start`, {
      method: 'POST',
      token: guest.sessionId
    });
    assert.equal(startedParticipationTask.response.status, 200);
    assert.equal(startedParticipationTask.payload.data.status, 'started');
    await new Promise(resolve => setTimeout(resolve, 30));
    const missingTaskProof = await jsonRequest(`/api/activities/${activity.id}/task/complete`, {
      method: 'POST',
      token: guest.sessionId
    });
    assert.equal(missingTaskProof.response.status, 400);

    const taskProofForm = new FormData();
    taskProofForm.append('proofNote', '已完成指定分享任务');
    taskProofForm.append('file', new Blob([Buffer.from('iVBORw0KGgo=', 'base64')], { type: 'image/png' }), 'task-proof.png');
    const taskProofUploadResponse = await fetch(`${server.baseUrl}/api/activities/${activity.id}/task/proof`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${guest.sessionId}` },
      body: taskProofForm
    });
    const taskProofUpload = await taskProofUploadResponse.json();
    assert.equal(taskProofUploadResponse.status, 200);
    assert.equal(taskProofUpload.data.proofSubmitted, true);
    const submittedParticipationTask = await jsonRequest(`/api/activities/${activity.id}/task/complete`, {
      method: 'POST',
      token: guest.sessionId
    });
    assert.equal(submittedParticipationTask.response.status, 200);
    assert.equal(submittedParticipationTask.payload.data.status, 'pending');

    const blockedUntilTaskReview = await jsonRequest(`/api/activities/${activity.id}/join`, {
      method: 'POST',
      token: guest.sessionId,
      data: {
        answerText: '4',
        voteAnswer: '红色'
      }
    });
    assert.equal(blockedUntilTaskReview.response.status, 403);

    const pendingTaskActivities = await jsonRequest('/api/admin/activities');
    const pendingTask = pendingTaskActivities.payload.data
      .find(item => item.id === activity.id)
      .taskReviews.find(item => item.status === 'pending');
    assert.equal(pendingTask.status, 'pending');
    assert.equal(pendingTask.proofNote, '已完成指定分享任务');
    const privateProofResponse = await fetch(`${server.baseUrl}/api/admin/activity-tasks/${pendingTask.id}/proof`);
    assert.equal(privateProofResponse.status, 200);
    assert.match(privateProofResponse.headers.get('content-type') || '', /image\/png/);

    const approvedTask = await jsonRequest(`/api/admin/activity-tasks/${pendingTask.id}/review`, {
      method: 'POST',
      data: { status: 'approved' }
    });
    assert.equal(approvedTask.response.status, 200);
    assert.equal(approvedTask.payload.data.status, 'completed');

    const joined = await jsonRequest(`/api/activities/${activity.id}/join`, {
      method: 'POST',
      token: guest.sessionId,
      data: {
        answerText: '4',
        voteAnswer: '红色'
      }
    });
    assert.equal(joined.response.status, 200, joined.payload.msg);
    assert.equal(joined.payload.data.joined, true);

    for (const [pathname, data] of [
      [`/api/activities/${activity.id}/view`, { viewerKey: 'extended-test-viewer' }],
      [`/api/activities/${activity.id}/share`, { channel: 'wechat' }],
      [`/api/activities/${activity.id}/comments`, { content: '这是通过真实接口保存的留言' }],
      [`/api/activities/${activity.id}/creator-subscription`, { subscribed: true }]
    ]) {
      const result = await jsonRequest(pathname, { method: 'POST', token: guest.sessionId, data });
      assert.equal(result.response.status, 200, result.payload.msg);
    }

    const detail = await jsonRequest(`/api/activities/${activity.id}`, { token: guest.sessionId });
    assert.equal(detail.payload.data.metrics.viewCount, 1);
    assert.equal(detail.payload.data.metrics.shareCount, 1);
    assert.equal(detail.payload.data.metrics.commentCount, 1);
    assert.equal(detail.payload.data.subscribedToCreator, true);

    const weightedDraw = await jsonRequest(`/api/admin/activities/${activity.id}/draw`, {
      method: 'POST',
      data: { count: 1 }
    });
    assert.equal(weightedDraw.response.status, 200, weightedDraw.payload.msg);
    assert.equal(weightedDraw.payload.data[0].selectionWeight, 1);

    const home = await jsonRequest('/api/home', { token: guest.sessionId });
    assert.ok(home.payload.data.official.some(item => item.id === activity.id));

    const expiredCash = await jsonRequest('/api/admin/activities', {
      method: 'POST',
      data: {
        title: '已过期开奖红包',
        status: 'live',
        drawMode: 'time',
        drawAt: new Date(Date.now() - 60 * 1000).toISOString(),
        homePlacement: 'cash'
      }
    });
    assert.equal(expiredCash.response.status, 200, expiredCash.payload.msg);
    const homeWithoutExpired = await jsonRequest('/api/home', { token: guest.sessionId });
    assert.equal(homeWithoutExpired.payload.data.cash.some(item => item.id === expiredCash.payload.data.id), false);

    const homepage = await jsonRequest('/api/me/homepage', { token: owner.sessionId });
    assert.ok(homepage.payload.data.activities.some(item => item.id === activity.id));
    const homePromotion = await jsonRequest(`/api/me/activities/${activity.id}/home-promotion`, {
      method: 'POST',
      token: owner.sessionId,
      data: { enabled: false }
    });
    assert.equal(homePromotion.response.status, 200, homePromotion.payload.msg);
    assert.equal(homePromotion.payload.data.promotion.platformRecommend, false);
    assert.equal(homePromotion.payload.data.homePlacement, '');
    const homeAfterPromotionDisabled = await jsonRequest('/api/home', { token: owner.sessionId });
    assert.equal(homeAfterPromotionDisabled.payload.data.official.some(item => item.id === activity.id), false);
    const forbiddenPromotion = await jsonRequest(`/api/me/activities/${activity.id}/home-promotion`, {
      method: 'POST',
      token: guest.sessionId,
      data: { enabled: true }
    });
    assert.equal(forbiddenPromotion.response.status, 403);
    const overview = await jsonRequest('/api/me/overview', { token: guest.sessionId });
    assert.equal('wishCount' in overview.payload.data, false);
    const premium = await jsonRequest('/api/me/premium', { token: guest.sessionId });
    assert.equal(premium.payload.data.authenticated, true);
    assert.equal(premium.payload.data.active, true);

    const partnership = await jsonRequest('/api/me/partnerships', {
      method: 'POST',
      token: guest.sessionId,
      data: { company: '测试品牌', contactName: '测试联系人', phone: '13800000000', needs: '联合运营活动' }
    });
    assert.equal(partnership.response.status, 200, partnership.payload.msg);
    assert.equal(partnership.payload.data.status, 'pending');

    const adminComments = await jsonRequest('/api/admin/comments');
    const savedComment = adminComments.payload.data.find(item => item.activityId === activity.id);
    assert.ok(savedComment);
    const hiddenComment = await jsonRequest(`/api/admin/comments/${savedComment.id}`, {
      method: 'PATCH',
      data: { status: 'hidden' }
    });
    assert.equal(hiddenComment.response.status, 200);
    const detailAfterModeration = await jsonRequest(`/api/activities/${activity.id}`, { token: guest.sessionId });
    assert.equal(detailAfterModeration.payload.data.metrics.commentCount, 0);
    assert.equal(detailAfterModeration.payload.data.comments.length, 0);

    const adminPartnerships = await jsonRequest('/api/admin/partnerships');
    const savedPartnership = adminPartnerships.payload.data.find(item => item.id === partnership.payload.data.id);
    assert.ok(savedPartnership);
    const contacted = await jsonRequest(`/api/admin/partnerships/${savedPartnership.id}`, {
      method: 'PATCH',
      data: { status: 'contacted' }
    });
    assert.equal(contacted.response.status, 200);
    assert.equal(contacted.payload.data.status, 'contacted');
  } finally {
    await server.stop();
    await code2session.close();
  }
});

test('connects creator subscriptions, advanced display rules, admin editing, and live events', async () => {
  const code2session = await startCode2SessionMock((req, res) => {
    const code = new URL(req.url, 'http://127.0.0.1').searchParams.get('js_code') || 'member';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ openid: `openid_rules_${code}`, session_key: `session_${code}` }));
  });
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'rules-secret',
    WECHAT_CODE2SESSION_URL: code2session.url
  });
  const requestJson = async (pathname, { method = 'GET', token = '', data } = {}) => {
    const response = await fetch(`${server.baseUrl}${pathname}`, {
      method,
      headers: {
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    return { response, payload: await response.json() };
  };

  try {
    const owner = await loginTestUser(server.baseUrl, 'owner');
    const follower = await loginTestUser(server.baseUrl, 'follower');
    const first = await requestJson('/api/activities', {
      method: 'POST',
      token: owner.sessionId,
      data: {
        prizes: [{ name: '订阅入口奖品', quantity: 1, type: '奖品' }],
        drawMode: 'time',
        drawAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        advanced: { enabled: true, futureSubscription: true }
      }
    });
    assert.equal(first.response.status, 200, first.payload.msg);
    const subscription = await requestJson(`/api/activities/${first.payload.data.id}/creator-subscription`, {
      method: 'POST',
      token: follower.sessionId,
      data: { subscribed: true }
    });
    assert.equal(subscription.response.status, 200, subscription.payload.msg);
    assert.equal(subscription.payload.data.subscribed, true);

    const second = await requestJson('/api/activities', {
      method: 'POST',
      token: owner.sessionId,
      data: {
        prizes: [{ name: '订阅后的新活动', quantity: 2, type: '奖品' }],
        drawMode: 'time',
        drawAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        leadInfo: '仅参与后展示的领奖联系方式',
        promotion: { platformRecommend: true },
        advanced: { enabled: true, cleanDisplay: true, exclusiveLanding: true }
      }
    });
    assert.equal(second.response.status, 200, second.payload.msg);
    const activityId = second.payload.data.id;

    const publicDetail = await requestJson(`/api/activities/${activityId}`, { token: follower.sessionId });
    assert.equal(publicDetail.response.status, 200, publicDetail.payload.msg);
    assert.equal(publicDetail.payload.data.displayMode, 'clean');
    assert.equal(publicDetail.payload.data.promotion.platformRecommend, false);
    assert.equal(publicDetail.payload.data.exclusiveLeadVisible, false);
    assert.equal(publicDetail.payload.data.leadInfo, '');

    const messages = await requestJson('/api/me/messages', { token: follower.sessionId });
    assert.equal(messages.response.status, 200, messages.payload.msg);
    assert.ok(messages.payload.data.some(item =>
      item.activityId === activityId && item.title === '你订阅的发起人发布了新抽奖'
    ));

    const updated = await requestJson(`/api/admin/activities/${activityId}`, {
      method: 'PUT',
      data: {
        drawMode: 'people',
        drawParticipantTarget: 25,
        conditions: {
          task: true,
          taskText: '体验指定页面 15 秒',
          taskDurationSeconds: 15,
          answer: true,
          answerQuestion: '活动口号是什么？'
        },
        advanced: {
          enabled: true,
          cleanDisplay: true,
          exclusiveLanding: true,
          comments: true,
          futureSubscription: true
        }
      }
    });
    assert.equal(updated.response.status, 200, updated.payload.msg);
    assert.equal(updated.payload.data.drawMode, 'people');
    assert.equal(updated.payload.data.drawParticipantTarget, 25);
    assert.equal(updated.payload.data.conditions.taskDurationSeconds, 15);
    assert.equal(updated.payload.data.advanced.comments, true);

    const event = await requestJson(`/api/activities/${activityId}/events`, {
      method: 'POST',
      token: owner.sessionId,
      data: { type: 'screen_message', payload: { text: '年会互动消息' } }
    });
    assert.equal(event.response.status, 200, event.payload.msg);
    assert.equal(event.payload.data.sequence, 1);
    const events = await requestJson(`/api/activities/${activityId}/events?after=0`);
    assert.equal(events.response.status, 200, events.payload.msg);
    assert.equal(events.payload.data[0].payload.text, '年会互动消息');

    const oversizedEvent = await requestJson(`/api/activities/${activityId}/events`, {
      method: 'POST',
      token: owner.sessionId,
      data: { type: 'screen_message', payload: { text: 'x'.repeat(4001) } }
    });
    assert.equal(oversizedEvent.response.status, 413);
  } finally {
    await server.stop();
    await code2session.close();
  }
});

test('connects creator activities, claims, team invitations, blacklist enforcement, and personal prizes', async () => {
  const code2session = await startCode2SessionMock((req, res) => {
    const code = new URL(req.url, 'http://127.0.0.1').searchParams.get('js_code') || 'member';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ openid: `openid_creator_${code}`, session_key: `session_${code}` }));
  });
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'creator-tools-secret',
    WECHAT_CODE2SESSION_URL: code2session.url
  });
  const requestJson = async (pathname, { method = 'GET', token = '', data } = {}) => {
    const response = await fetch(`${server.baseUrl}${pathname}`, {
      method,
      headers: {
        ...(data === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) })
    });
    return { response, payload: await response.json() };
  };

  try {
    const owner = await loginTestUser(server.baseUrl, 'creator-owner');
    const participant = await loginTestUser(server.baseUrl, 'creator-participant');
    const teammate = await loginTestUser(server.baseUrl, 'creator-teammate');
    const activityData = title => ({
      title,
      prizes: [{ name: `${title}奖品`, quantity: 1, type: '奖品' }],
      drawMode: 'time',
      drawAt: new Date(Date.now() + 60 * 60 * 1000).toISOString()
    });

    const first = await requestJson('/api/activities', {
      method: 'POST', token: owner.sessionId, data: activityData('发起人管理测试一')
    });
    assert.equal(first.response.status, 200, first.payload.msg);
    const firstId = first.payload.data.id;
    const joined = await requestJson(`/api/activities/${firstId}/join`, {
      method: 'POST', token: participant.sessionId, data: {}
    });
    assert.equal(joined.response.status, 200, joined.payload.msg);

    const activityList = await requestJson('/api/me/creator-activities', { token: owner.sessionId });
    assert.equal(activityList.response.status, 200, activityList.payload.msg);
    assert.ok(activityList.payload.data.activities.some(item => item.id === firstId && item.participantCount === 1));

    const blacklist = await requestJson('/api/me/blacklist', { token: owner.sessionId });
    assert.equal(blacklist.response.status, 200, blacklist.payload.msg);
    assert.equal(blacklist.payload.data.candidates.length, 1);
    const candidate = blacklist.payload.data.candidates[0];
    assert.ok(candidate);
    const blockedEntry = await requestJson('/api/me/blacklist', {
      method: 'POST', token: owner.sessionId, data: { participantId: candidate.participantId, reason: '测试拦截' }
    });
    assert.equal(blockedEntry.response.status, 200, blockedEntry.payload.msg);

    const second = await requestJson('/api/activities', {
      method: 'POST', token: owner.sessionId, data: activityData('发起人管理测试二')
    });
    assert.equal(second.response.status, 200, second.payload.msg);
    const blockedJoin = await requestJson(`/api/activities/${second.payload.data.id}/join`, {
      method: 'POST', token: participant.sessionId, data: {}
    });
    assert.equal(blockedJoin.response.status, 403);

    const invitation = await requestJson('/api/me/team/invitations', {
      method: 'POST', token: owner.sessionId, data: { displayName: '门店核销员', role: 'verifier' }
    });
    assert.equal(invitation.response.status, 200, invitation.payload.msg);
    const accepted = await requestJson('/api/me/team/invitations/accept', {
      method: 'POST', token: teammate.sessionId, data: { inviteCode: invitation.payload.data.inviteCode }
    });
    assert.equal(accepted.response.status, 200, accepted.payload.msg);
    const teammateActivities = await requestJson('/api/me/creator-activities', { token: teammate.sessionId });
    assert.equal(teammateActivities.response.status, 200, teammateActivities.payload.msg);
    assert.ok(teammateActivities.payload.data.activities.some(item => item.id === firstId && item.canClaim === true));

    const draw = await requestJson(`/api/admin/activities/${firstId}/draw`, {
      method: 'POST', data: { count: 1 }
    });
    assert.equal(draw.response.status, 200, draw.payload.msg);
    assert.equal(draw.payload.data.length, 1);
    const claims = await requestJson('/api/me/claims', { token: teammate.sessionId });
    assert.equal(claims.response.status, 200, claims.payload.msg);
    assert.equal(claims.payload.data.length, 1);
    const claimId = claims.payload.data[0].id;
    const claimed = await requestJson(`/api/me/claims/${claimId}`, {
      method: 'PUT', token: teammate.sessionId, data: { claimed: true }
    });
    assert.equal(claimed.response.status, 200, claimed.payload.msg);
    assert.equal(claimed.payload.data.claimed, true);
    const restored = await requestJson(`/api/me/claims/${claimId}`, {
      method: 'PUT', token: teammate.sessionId, data: { claimed: false }
    });
    assert.equal(restored.response.status, 200, restored.payload.msg);
    assert.equal(restored.payload.data.claimed, false);

    const prizes = await requestJson('/api/me/prizes', { token: participant.sessionId });
    assert.equal(prizes.response.status, 200, prizes.payload.msg);
    assert.ok(prizes.payload.data.some(item => item.activityId === firstId));

    const removed = await requestJson(`/api/me/blacklist/${blockedEntry.payload.data.id}`, {
      method: 'DELETE', token: owner.sessionId
    });
    assert.equal(removed.response.status, 200, removed.payload.msg);
    const joinAfterRemoval = await requestJson(`/api/activities/${second.payload.data.id}/join`, {
      method: 'POST', token: participant.sessionId, data: {}
    });
    assert.equal(joinAfterRemoval.response.status, 200, joinAfterRemoval.payload.msg);
  } finally {
    await server.stop();
    await code2session.close();
  }
});

test('allows advanced live activities without payment and keeps the payment module isolated', async () => {
  const merchantKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const platformKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const merchantPrivateKey = merchantKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const platformPublicKey = platformKeys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const platformSerial = 'platform-test-serial';
  const merchantSerial = 'merchant-test-serial';
  const merchantId = '1900000109';
  const apiV3Key = '0123456789abcdef0123456789abcdef';
  let paymentRequest = null;
  let queryTransaction = null;
  let merchantRequestVerified = true;

  const payPort = await freePort();
  const payServer = createServer((req, res) => {
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk.toString(); });
    req.on('end', () => {
      const auth = String(req.headers.authorization || '');
      const fields = Object.fromEntries([...auth.matchAll(/(mchid|nonce_str|timestamp|serial_no|signature)="([^"]+)"/g)]
        .map(match => [match[1], match[2]]));
      const signatureMessage = `${req.method}\n${req.url}\n${fields.timestamp}\n${fields.nonce_str}\n${rawBody}\n`;
      merchantRequestVerified = merchantRequestVerified && fields.mchid === merchantId &&
        fields.serial_no === merchantSerial &&
        crypto.verify(
          'RSA-SHA256',
          Buffer.from(signatureMessage, 'utf8'),
          merchantKeys.publicKey,
          Buffer.from(fields.signature || '', 'base64')
        );
      if (req.method === 'POST') paymentRequest = JSON.parse(rawBody);
      const responseBody = JSON.stringify(req.method === 'GET'
        ? queryTransaction
        : { prepay_id: 'wx-prepay-advanced-test' });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const nonce = 'platform-response-nonce';
      const signature = crypto.sign(
        'RSA-SHA256',
        Buffer.from(`${timestamp}\n${nonce}\n${responseBody}\n`, 'utf8'),
        platformKeys.privateKey
      ).toString('base64');
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Wechatpay-Timestamp': timestamp,
        'Wechatpay-Nonce': nonce,
        'Wechatpay-Serial': platformSerial,
        'Wechatpay-Signature': signature
      });
      res.end(responseBody);
    });
  });
  await new Promise((resolve, reject) => {
    payServer.once('error', reject);
    payServer.listen(payPort, '127.0.0.1', resolve);
  });

  const code2session = await startCode2SessionMock((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ openid: 'openid_payment_owner', session_key: 'session_payment_owner' }));
  });
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'payment-test-secret',
    WECHAT_CODE2SESSION_URL: code2session.url,
    WECHAT_PAY_MCH_ID: merchantId,
    WECHAT_PAY_SERIAL_NO: merchantSerial,
    WECHAT_PAY_PRIVATE_KEY: merchantPrivateKey,
    WECHAT_PAY_API_V3_KEY: apiV3Key,
    WECHAT_PAY_PLATFORM_SERIAL_NO: platformSerial,
    WECHAT_PAY_PLATFORM_PUBLIC_KEY: platformPublicKey,
    WECHAT_PAY_NOTIFY_URL: 'https://lottery.example.com/api/payments/wechat/notify',
    WECHAT_PAY_API_BASE_URL: `http://127.0.0.1:${payPort}`,
    ADVANCED_FEATURE_PRICE_CENTS: '990'
  });

  const requestJson = async (pathname, { method = 'GET', token = '', data, headers = {} } = {}) => {
    const rawBody = data === undefined ? undefined : (typeof data === 'string' ? data : JSON.stringify(data));
    const response = await fetch(`${server.baseUrl}${pathname}`, {
      method,
      headers: {
        ...(rawBody === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      ...(rawBody === undefined ? {} : { body: rawBody })
    });
    return { response, payload: await response.json() };
  };

  try {
    const owner = await loginTestUser(server.baseUrl, 'payment-owner');
    const baseActivity = {
      prizes: [{ name: '高级功能真实支付奖品', quantity: 1, type: '奖品' }],
      drawMode: 'time',
      drawAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      advanced: { enabled: true, analytics: true }
    };
    const freePublished = await requestJson('/api/activities', {
      method: 'POST', token: owner.sessionId, data: baseActivity
    });
    assert.equal(freePublished.response.status, 200, freePublished.payload.msg);
    assert.equal(freePublished.payload.data.advanced.enabled, true);

    const draft = await requestJson('/api/activities', {
      method: 'POST', token: owner.sessionId, data: { ...baseActivity, status: 'draft' }
    });
    assert.equal(draft.response.status, 200, draft.payload.msg);

    const payment = await requestJson('/api/payments/wechat/advanced-feature', {
      method: 'POST', token: owner.sessionId, data: {}
    });
    assert.equal(payment.response.status, 200, payment.payload.msg);
    assert.equal(merchantRequestVerified, true);
    assert.equal(paymentRequest.amount.total, 990);
    assert.equal(paymentRequest.payer.openid, owner.openid);
    assert.equal(payment.payload.data.amount, 9.9);
    const retriedPayment = await requestJson('/api/payments/wechat/advanced-feature', {
      method: 'POST', token: owner.sessionId, data: {}
    });
    assert.equal(retriedPayment.response.status, 200, retriedPayment.payload.msg);
    assert.equal(retriedPayment.payload.data.orderId, payment.payload.data.orderId);
    const payParams = payment.payload.data.paymentParams;
    assert.equal(crypto.verify(
      'RSA-SHA256',
      Buffer.from(`wxexampleappid0001\n${payParams.timeStamp}\n${payParams.nonceStr}\n${payParams.package}\n`, 'utf8'),
      merchantKeys.publicKey,
      Buffer.from(payParams.paySign, 'base64')
    ), true);

    const transaction = {
      appid: 'wxexampleappid0001',
      mchid: merchantId,
      out_trade_no: paymentRequest.out_trade_no,
      transaction_id: '4200000000000000001',
      trade_type: 'JSAPI',
      trade_state: 'SUCCESS',
      trade_state_desc: '支付成功',
      bank_type: 'OTHERS',
      success_time: new Date().toISOString(),
      payer: { openid: owner.openid },
      amount: { total: 990, payer_total: 990, currency: 'CNY', payer_currency: 'CNY' }
    };
    const associatedData = 'transaction';
    const resourceNonce = 'paynonce1234';
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(apiV3Key, 'utf8'),
      Buffer.from(resourceNonce, 'utf8')
    );
    cipher.setAAD(Buffer.from(associatedData, 'utf8'));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(transaction), 'utf8'),
      cipher.final(),
      cipher.getAuthTag()
    ]).toString('base64');
    const notifyBody = JSON.stringify({
      id: 'notify-payment-test',
      create_time: new Date().toISOString(),
      event_type: 'TRANSACTION.SUCCESS',
      resource_type: 'encrypt-resource',
      summary: '支付成功',
      resource: {
        original_type: 'transaction',
        algorithm: 'AEAD_AES_256_GCM',
        ciphertext,
        associated_data: associatedData,
        nonce: resourceNonce
      }
    });
    const notifyTimestamp = String(Math.floor(Date.now() / 1000));
    const notifyNonce = 'notify-signature-nonce';
    const notifySignature = crypto.sign(
      'RSA-SHA256',
      Buffer.from(`${notifyTimestamp}\n${notifyNonce}\n${notifyBody}\n`, 'utf8'),
      platformKeys.privateKey
    ).toString('base64');
    const notifyHeaders = {
      'Wechatpay-Timestamp': notifyTimestamp,
      'Wechatpay-Nonce': notifyNonce,
      'Wechatpay-Serial': platformSerial,
      'Wechatpay-Signature': notifySignature
    };
    queryTransaction = transaction;
    const synced = await requestJson(`/api/payments/orders/${payment.payload.data.orderId}/sync`, {
      method: 'POST', token: owner.sessionId, data: {}
    });
    assert.equal(synced.response.status, 200, synced.payload.msg);
    assert.equal(synced.payload.data.status, 'paid');
    assert.equal(merchantRequestVerified, true);

    const notified = await requestJson('/api/payments/wechat/notify', {
      method: 'POST', data: notifyBody, headers: notifyHeaders
    });
    assert.equal(notified.response.status, 200, notified.payload.message);

    const paidOrder = await requestJson(`/api/payments/orders/${payment.payload.data.orderId}`, {
      token: owner.sessionId
    });
    assert.equal(paidOrder.payload.data.status, 'paid');

    const duplicateNotify = await requestJson('/api/payments/wechat/notify', {
      method: 'POST', data: notifyBody, headers: notifyHeaders
    });
    assert.equal(duplicateNotify.response.status, 200);
    const afterDuplicate = await requestJson(`/api/payments/orders/${payment.payload.data.orderId}`, {
      token: owner.sessionId
    });
    assert.equal(afterDuplicate.payload.data.status, 'paid');
    assert.equal(afterDuplicate.payload.data.activityId, '');
  } finally {
    await server.stop();
    await code2session.close();
    await new Promise(resolve => payServer.close(resolve));
  }
});

test('persists annual draw settings, protects the candidate list, and draws prize tiers in reverse order', async () => {
  const code2session = await startCode2SessionMock((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const code = url.searchParams.get('js_code') || 'member';
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ openid: `openid_${code}`, session_key: `session_${code}` }));
  });
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'annual-test-secret',
    WECHAT_CODE2SESSION_URL: code2session.url
  });

  const login = async (code, nickname) => {
    const response = await fetch(`${server.baseUrl}/api/auth/wechat-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, nickname, profileConfirmed: true })
    });
    assert.equal(response.status, 200);
    return (await response.json()).data;
  };

  try {
    const owner = await login('annual-owner', '年会主持人');
    const allowed = await login('annual-allowed', '名单用户');
    const rejected = await login('annual-rejected', '未授权用户');
    const createResponse = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner.sessionId}`
      },
      body: JSON.stringify({
        templateType: '年会抽奖',
        prizes: [
          { name: '一等奖', quantity: 1, type: '奖品' },
          { name: '二等奖', quantity: 1, type: '奖品' }
        ],
        drawMode: 'time',
        drawAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        specialConfig: {
          annualReverseDraw: true,
          annual: {
            companyName: '测试公司',
            activityTheme: '年度盛典',
            candidateNames: ['名单用户']
          }
        }
      })
    });
    const createPayload = await createResponse.json();
    assert.equal(createResponse.status, 200, createPayload.msg);
    assert.equal(createPayload.data.specialConfig.annual.companyName, '测试公司');
    assert.deepEqual(createPayload.data.specialConfig.annual.candidateNames, ['名单用户']);
    const activityId = createPayload.data.id;

    const publicDetail = await fetch(`${server.baseUrl}/api/activities/${activityId}`);
    const publicPayload = await publicDetail.json();
    assert.equal(publicDetail.status, 200);
    assert.equal(publicPayload.data.specialConfig.annual.candidateCount, 1);
    assert.deepEqual(publicPayload.data.specialConfig.annual.candidateNames, []);

    const rejectedJoin = await fetch(`${server.baseUrl}/api/activities/${activityId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${rejected.sessionId}`
      },
      body: JSON.stringify({})
    });
    assert.equal(rejectedJoin.status, 403);

    const allowedJoin = await fetch(`${server.baseUrl}/api/activities/${activityId}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${allowed.sessionId}`
      },
      body: JSON.stringify({})
    });
    assert.equal(allowedJoin.status, 200);

    const drawResponse = await fetch(`${server.baseUrl}/api/admin/activities/${activityId}/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 1 })
    });
    const drawPayload = await drawResponse.json();
    assert.equal(drawResponse.status, 200, drawPayload.msg);
    assert.equal(drawPayload.data[0].prize.name, '二等奖');
  } finally {
    await server.stop();
    await code2session.close();
  }
});

test('automatically draws a people-based activity at its fallback time', async () => {
  const code2session = await startCode2SessionMock((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ openid: 'openid_due_member', session_key: 'session_due_member' }));
  });
  const server = await startServer({
    WECHAT_APPID: 'wxexampleappid0001',
    WECHAT_APP_SECRET: 'test-secret',
    WECHAT_CODE2SESSION_URL: code2session.url,
    DRAW_SCHEDULER_INTERVAL_MS: '10000'
  });

  try {
    const loginResponse = await fetch(`${server.baseUrl}/api/auth/wechat-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'due-code', nickname: 'Due member' })
    });
    const login = (await loginResponse.json()).data;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${login.sessionId}`
    };
    const createResponse = await fetch(`${server.baseUrl}/api/activities`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prizeName: 'Due prize',
        prizeQuantity: 1,
        drawMode: 'people',
        drawParticipantTarget: 99,
        drawAt: new Date(Date.now() + 1_000).toISOString()
      })
    });
    const activity = (await createResponse.json()).data;
    const joinResponse = await fetch(`${server.baseUrl}/api/activities/${activity.id}/join`, {
      method: 'POST',
      headers,
      body: JSON.stringify({})
    });
    assert.equal(joinResponse.status, 200);

    let detail = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await new Promise(resolve => setTimeout(resolve, 1_000));
      const response = await fetch(`${server.baseUrl}/api/activities/${activity.id}`, { headers });
      detail = (await response.json()).data;
      if (detail.status === 'drawn') break;
    }
    assert.equal(detail.status, 'drawn');
    assert.equal(detail.winners.length, 1);
  } finally {
    await server.stop();
    await code2session.close();
  }
});
