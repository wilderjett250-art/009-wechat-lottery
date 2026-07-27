import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import { createDataStore } from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'db.json');
const seedPath = process.env.SEED_PATH ? path.resolve(process.env.SEED_PATH) : path.join(__dirname, 'data', 'seed.json');
const databaseUrl = String(process.env.DATABASE_URL || '').trim();
const hideSampleData = String(process.env.HIDE_SAMPLE_DATA || '').trim().toLowerCase() === 'true';
const publicDir = path.join(__dirname, 'public');
const uploadDir = path.join(dataDir, 'uploads');
const taskProofDir = path.join(dataDir, 'task-proofs');
const port = Number(process.env.PORT || 5177);
const host = process.env.HOST || '127.0.0.1';
const adminToken = String(process.env.ADMIN_TOKEN || '').trim();
const wechatAppId = String(process.env.WECHAT_APPID || 'wxexampleappid0001').trim();
const wechatAppSecret = String(process.env.WECHAT_APP_SECRET || process.env.WECHAT_SECRET || '').trim();
const code2SessionUrl = String(process.env.WECHAT_CODE2SESSION_URL || 'https://api.weixin.qq.com/sns/jscode2session').trim();
const wechatAccessTokenUrl = String(process.env.WECHAT_ACCESS_TOKEN_URL || 'https://api.weixin.qq.com/cgi-bin/stable_token').trim();
const wechatSubscribeSendUrl = String(process.env.WECHAT_SUBSCRIBE_SEND_URL || 'https://api.weixin.qq.com/cgi-bin/message/subscribe/send').trim();
// WECHAT_DRAW_TEMPLATE_ID is kept for backward compatibility with deployed result subscriptions.
const wechatDrawResultTemplateId = String(process.env.WECHAT_DRAW_TEMPLATE_ID || '').trim();
const wechatDrawReminderTemplateId = String(process.env.WECHAT_DRAW_REMINDER_TEMPLATE_ID || '').trim();
const wechatCashTemplateId = String(process.env.WECHAT_CASH_TEMPLATE_ID || '').trim();
const wechatCommentTemplateId = String(process.env.WECHAT_COMMENT_TEMPLATE_ID || '').trim();
const wechatDrawResultTemplateData = String(process.env.WECHAT_DRAW_TEMPLATE_DATA || '').trim();
const wechatDrawReminderTemplateData = String(process.env.WECHAT_DRAW_REMINDER_TEMPLATE_DATA || '').trim();
const wechatCashTemplateData = String(process.env.WECHAT_CASH_TEMPLATE_DATA || '').trim();
const wechatCommentTemplateData = String(process.env.WECHAT_COMMENT_TEMPLATE_DATA || '').trim();
const wechatNotifyPage = String(process.env.WECHAT_NOTIFY_PAGE || 'pages/records/records').trim();
const wechatMiniProgramState = String(process.env.WECHAT_MINIPROGRAM_STATE || 'formal').trim();
const wechatPayMchId = String(process.env.WECHAT_PAY_MCH_ID || '').trim();
const wechatPaySerialNo = String(process.env.WECHAT_PAY_SERIAL_NO || '').trim();
const wechatPayPrivateKeyValue = String(process.env.WECHAT_PAY_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
const wechatPayPrivateKeyPath = String(process.env.WECHAT_PAY_PRIVATE_KEY_PATH || '').trim();
const wechatPayApiV3Key = String(process.env.WECHAT_PAY_API_V3_KEY || '').trim();
const wechatPayPlatformSerialNo = String(process.env.WECHAT_PAY_PLATFORM_SERIAL_NO || '').trim();
const wechatPayPlatformPublicKeyValue = String(process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY || '').replace(/\\n/g, '\n').trim();
const wechatPayPlatformPublicKeyPath = String(process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH || '').trim();
const wechatPayNotifyUrl = String(process.env.WECHAT_PAY_NOTIFY_URL || '').trim();
const wechatPayApiBaseUrl = String(process.env.WECHAT_PAY_API_BASE_URL || 'https://api.mch.weixin.qq.com').replace(/\/$/, '');
const advancedFeaturePriceCents = Math.max(0, Math.round(Number(process.env.ADVANCED_FEATURE_PRICE_CENTS ?? 0)));
const officialAccountAppId = String(process.env.OFFICIAL_ACCOUNT_APPID || '').trim();
const officialAccountAppSecret = String(process.env.OFFICIAL_ACCOUNT_APP_SECRET || '').trim();
const officialAccountToken = String(process.env.OFFICIAL_ACCOUNT_TOKEN || '').trim();
const officialAccountName = String(process.env.OFFICIAL_ACCOUNT_NAME || '').trim();
const officialAccountUsername = String(process.env.OFFICIAL_ACCOUNT_USERNAME || '').trim();
const officialAccountAccessTokenUrl = String(process.env.OFFICIAL_ACCOUNT_ACCESS_TOKEN_URL || 'https://api.weixin.qq.com/cgi-bin/stable_token').trim();
const officialAccountUserInfoUrl = String(process.env.OFFICIAL_ACCOUNT_USER_INFO_URL || 'https://api.weixin.qq.com/cgi-bin/user/info').trim();
const wechatOpenComponentAppId = String(process.env.WECHAT_OPEN_COMPONENT_APPID || '').trim();
const wechatOpenComponentAppSecret = String(process.env.WECHAT_OPEN_COMPONENT_APP_SECRET || '').trim();
const wechatOpenComponentToken = String(process.env.WECHAT_OPEN_COMPONENT_TOKEN || '').trim();
const wechatOpenComponentAesKey = String(process.env.WECHAT_OPEN_COMPONENT_AES_KEY || '').trim();
const wechatOpenApiBaseUrl = String(process.env.WECHAT_OPEN_API_BASE_URL || 'https://api.weixin.qq.com').replace(/\/$/, '');
const wechatOpenAuthPageUrl = String(process.env.WECHAT_OPEN_AUTH_PAGE_URL || 'https://mp.weixin.qq.com/cgi-bin/componentloginpage').trim();
const wechatOpenPublicBaseUrl = String(process.env.WECHAT_OPEN_PUBLIC_BASE_URL || 'https://lottery.example.com').replace(/\/$/, '');
const wechatOpenAuthRedirectUrl = String(process.env.WECHAT_OPEN_AUTH_REDIRECT_URL || `${wechatOpenPublicBaseUrl}/api/wechat/open-platform/authorization/callback`).trim();
const wechatOpenUserInfoUrl = String(process.env.WECHAT_OPEN_USER_INFO_URL || 'https://api.weixin.qq.com/cgi-bin/user/info').trim();
const miniProgramLaunchUrl = String(process.env.MINIPROGRAM_LAUNCH_URL || '').trim();
const wecomCorpId = String(process.env.WECOM_CORP_ID || '').trim();
const wecomContactSecret = String(process.env.WECOM_CONTACT_SECRET || '').trim();
const wecomName = String(process.env.WECOM_NAME || '').trim();
const wecomApiBaseUrl = String(process.env.WECOM_API_BASE_URL || 'https://qyapi.weixin.qq.com').replace(/\/$/, '');
function positiveNumber(value, fallback, minimum = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
}

const drawSchedulerIntervalMs = positiveNumber(process.env.DRAW_SCHEDULER_INTERVAL_MS, 30_000, 1_000);
const drawReminderLeadMs = positiveNumber(process.env.DRAW_REMINDER_LEAD_MS, 30 * 60 * 1000, 1_000);
const notificationRetryDelaysMs = String(process.env.NOTIFICATION_RETRY_DELAYS_MS || '60000,300000,1800000,7200000')
  .split(',')
  .map(value => Number(value.trim()))
  .filter(Number.isFinite)
  .map(value => Math.max(1_000, value));
const notificationMaxAttempts = positiveNumber(
  process.env.NOTIFICATION_MAX_ATTEMPTS,
  notificationRetryDelaysMs.length + 1,
  1
);
const sessionLifetimeMs = positiveNumber(
  process.env.SESSION_LIFETIME_MS,
  30 * 24 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000
);
const adminSessionLifetimeMs = positiveNumber(
  process.env.ADMIN_SESSION_LIFETIME_MS,
  8 * 60 * 60 * 1000,
  15 * 60 * 1000
);
const loginRateLimitWindowMs = positiveNumber(process.env.LOGIN_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000, 60 * 1000);
const loginRateLimitMax = positiveNumber(process.env.LOGIN_RATE_LIMIT_MAX, 20, 1);
const activityActionRateLimitWindowMs = positiveNumber(
  process.env.ACTIVITY_ACTION_RATE_LIMIT_WINDOW_MS,
  60 * 1000,
  10 * 1000
);
const activityActionRateLimitMax = positiveNumber(process.env.ACTIVITY_ACTION_RATE_LIMIT_MAX, 90, 5);
const maxStoredSessions = positiveNumber(process.env.MAX_STORED_SESSIONS, 10_000, 1_000);
const checkInTaskMinDurationMs = process.env.CHECK_IN_TASK_MIN_DURATION_MS === undefined
  ? null
  : Math.max(0, Number(process.env.CHECK_IN_TASK_MIN_DURATION_MS || 0));
const activityTaskMinDurationMs = process.env.ACTIVITY_TASK_MIN_DURATION_MS === undefined
  ? null
  : Math.max(0, Number(process.env.ACTIVITY_TASK_MIN_DURATION_MS || 0));
const groupProofLifetimeMs = 15 * 60 * 1000;

let dbWriteQueue = Promise.resolve();
let mutationQueue = Promise.resolve();
let cachedWechatAccessToken = null;
let cachedOfficialAccountAccessToken = null;
let cachedWechatOpenComponentAccessToken = null;
let cachedWecomAccessToken = null;
let cachedWechatPayPrivateKey = null;
let cachedWechatPayPlatformPublicKey = null;
let dataStore;

const app = express();
app.set('trust proxy', 1);
app.use(express.text({ type: ['text/xml', 'application/xml'], limit: '1mb' }));
app.use(express.json({
  limit: '8mb',
  verify(req, res, buffer) {
    req.rawBody = buffer.toString('utf8');
  }
}));
app.use((error, req, res, next) => {
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ code: 400, msg: '请求数据格式错误' });
  }
  return next(error);
});
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.use('/uploads', express.static(uploadDir));
app.use(express.static(publicDir));

function serializeHttpMutation(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const previous = mutationQueue;
  let release;
  const completion = new Promise(resolve => { release = resolve; });
  mutationQueue = previous.then(() => completion).catch(() => {});

  previous.then(() => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      release();
    };
    res.once('finish', done);
    res.once('close', done);
    next();
  }).catch(next);
}

function enqueueBackgroundMutation(work) {
  const previous = mutationQueue;
  let release;
  const completion = new Promise(resolve => { release = resolve; });
  mutationQueue = previous.then(() => completion).catch(() => {});
  return previous.then(work).finally(release);
}

app.use(serializeHttpMutation);

function parseCookies(header = '') {
  return Object.fromEntries(header
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .map(part => {
      const separator = part.indexOf('=');
      if (separator === -1) return [part, ''];
      const key = part.slice(0, separator);
      const value = part.slice(separator + 1);
      try {
        return [key, decodeURIComponent(value)];
      } catch {
        return [key, ''];
      }
    }));
}

function safeTextEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function adminSessionSigningKey() {
  return crypto.createHash('sha256').update(`lottery-admin-session:${adminToken}`).digest();
}

function createAdminSession() {
  const payload = Buffer.from(JSON.stringify({
    expiresAt: Date.now() + adminSessionLifetimeMs,
    nonce: crypto.randomBytes(16).toString('hex')
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', adminSessionSigningKey()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function verifyAdminSession(value) {
  if (!adminToken || !value) return false;
  const [payload, signature] = String(value).split('.');
  if (!payload || !signature) return false;
  const expected = crypto.createHmac('sha256', adminSessionSigningKey()).update(payload).digest('base64url');
  if (!safeTextEquals(signature, expected)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(Number(parsed.expiresAt)) && Number(parsed.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

function setAdminSessionCookie(res, req) {
  res.cookie('admin_session', createAdminSession(), {
    httpOnly: true,
    sameSite: 'strict',
    secure: Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https'),
    path: '/',
    maxAge: adminSessionLifetimeMs
  });
}

function requestAdminToken(req) {
  const authorization = String(req.headers.authorization || '');
  if (authorization.startsWith('Bearer ')) return authorization.slice('Bearer '.length).trim();
  if (req.headers['x-admin-token']) return String(req.headers['x-admin-token']);
  return '';
}

function requestBearerToken(req) {
  const authorization = String(req.headers.authorization || '');
  if (!authorization.startsWith('Bearer ')) return '';
  return authorization.slice('Bearer '.length).trim();
}

function hasAdminAccess(req) {
  if (!adminToken) return true;
  if (safeTextEquals(requestAdminToken(req), adminToken)) return true;
  return verifyAdminSession(parseCookies(req.headers.cookie || '').admin_session);
}

function requireAdmin(req, res, next) {
  if (hasAdminAccess(req)) return next();
  return fail(res, 401, '后台访问未授权');
}

async function ensureDb() {
  await dataStore.ensure();
}

function dbDefaults() {
  return {
    memberStats: {
      total: 0,
      created: 0,
      won: 0
    },
    wallet: {
      balance: 0,
      frozen: 0,
      records: []
    },
    wechatOpenPlatform: {
      componentVerifyTicket: '',
      ticketUpdatedAt: ''
    },
    coupons: [],
    orders: [],
    checkIns: [],
    activityViews: [],
    comments: [],
    creatorSubscriptions: [],
    activityTasks: [],
    activityEvents: [],
    messages: [],
    riskEvents: [],
    partnerships: [],
    creatorTeamMembers: [],
    creatorBlacklists: []
  };
}

function isLegacyDemoMemberData(db) {
  const stats = db.memberStats || {};
  const wallet = db.wallet || {};
  const coupons = Array.isArray(db.coupons) ? db.coupons : [];
  const orders = Array.isArray(db.orders) ? db.orders : [];
  return Number(stats.total) === 117 &&
    Number(stats.created) === 4 &&
    Number(stats.won) === 23 &&
    Number(wallet.balance) === 66.6 &&
    coupons.some(item => item.id === 'coupon_1') &&
    orders.some(item => item.id === 'order_1');
}

function normalizeDb(db) {
  const defaults = dbDefaults();
  let changed = false;
  for (const key of [
    'activities',
    'prizes',
    'participants',
    'winners',
    'shares',
    'members',
    'sessions',
    'subscriptions',
    'notificationLogs',
    'participationApplications',
    'assists',
    'officialFollowers',
    'officialAccountAuthorizations',
    'wecomContacts',
    'wecomGroups',
    'checkIns',
    'activityViews',
    'comments',
    'creatorSubscriptions',
    'activityTasks',
    'activityEvents',
    'messages',
    'riskEvents',
    'partnerships',
    'creatorTeamMembers',
    'creatorBlacklists'
  ]) {
    if (!Array.isArray(db[key])) {
      db[key] = [];
      changed = true;
    }
  }
  const sampleHomePlacement = {
    act_1001: 'official',
    act_1007: 'cash'
  };
  for (const activity of db.activities) {
    const participationConditions = normalizeParticipationConditions(activity.conditions);
    if (participationConditions.passcode ||
      participationConditions.passcodeValue ||
      participationConditions.passcodeHash) {
      activity.conditions = {
        ...participationConditions,
        passcode: false,
        passcodeValue: '',
        passcodeHash: ''
      };
      changed = true;
    }
    if (typeof activity.unlockByPeople !== 'boolean') {
      activity.unlockByPeople = false;
      changed = true;
    }
    if (!Number.isInteger(Number(activity.instantPerUserLimit)) || Number(activity.instantPerUserLimit) < 1) {
      activity.instantPerUserLimit = 1;
      changed = true;
    }
    if (!Number.isInteger(Number(activity.instantParticipantLimit)) || Number(activity.instantParticipantLimit) < 5) {
      activity.instantParticipantLimit = 5;
      changed = true;
    }
    if (!activity.homePlacement && sampleHomePlacement[activity.id]) {
      activity.homePlacement = sampleHomePlacement[activity.id];
      changed = true;
    }
    if (/^act_100[1-8]$/.test(String(activity.id || '')) &&
      activity.status === 'live' && new Date(activity.drawAt).getTime() <= Date.now()) {
      const offset = Number(String(activity.id).slice(-1)) || 1;
      activity.drawAt = new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString();
      activity.endAt = activity.drawAt;
      changed = true;
    }
  }
  const sampleCashPrize = db.prizes.find(item => item.id === 'prize_2007');
  if (sampleCashPrize && !sampleCashPrize.type) {
    sampleCashPrize.type = '红包';
    sampleCashPrize.faceValue = 666;
    changed = true;
  }
  for (const prize of db.prizes) {
    const unlockParticipants = Number(prize.unlockParticipants || 0);
    if (!Number.isInteger(unlockParticipants) || unlockParticipants < 0) {
      prize.unlockParticipants = 0;
      changed = true;
    }
  }
  for (const participant of db.participants) {
    const attemptCount = Number(participant.attemptCount || 1);
    if (!Number.isInteger(attemptCount) || attemptCount < 1) {
      participant.attemptCount = 1;
      changed = true;
    }
  }
  for (const activity of db.activities.filter(item => item.drawMode === 'instant')) {
    const attemptCount = db.participants
      .filter(item => item.activityId === activity.id)
      .reduce((sum, item) => sum + Math.max(1, Number(item.attemptCount || 1)), 0);
    if (!Number.isInteger(Number(activity.instantAttemptCount)) || Number(activity.instantAttemptCount) < attemptCount) {
      activity.instantAttemptCount = attemptCount;
      changed = true;
    }
  }
  if (!db.memberStats || typeof db.memberStats !== 'object') {
    db.memberStats = defaults.memberStats;
    changed = true;
  }
  if (!db.wallet || typeof db.wallet !== 'object') {
    db.wallet = defaults.wallet;
    changed = true;
  } else {
    if (!Number.isFinite(Number(db.wallet.balance))) {
      db.wallet.balance = defaults.wallet.balance;
      changed = true;
    }
    if (!Number.isFinite(Number(db.wallet.frozen))) {
      db.wallet.frozen = defaults.wallet.frozen;
      changed = true;
    }
    if (!Array.isArray(db.wallet.records)) {
      db.wallet.records = defaults.wallet.records;
      changed = true;
    }
  }
  if (!db.wechatOpenPlatform || typeof db.wechatOpenPlatform !== 'object') {
    db.wechatOpenPlatform = defaults.wechatOpenPlatform;
    changed = true;
  }
  if (!Array.isArray(db.coupons)) {
    db.coupons = defaults.coupons;
    changed = true;
  }
  if (!Array.isArray(db.orders)) {
    db.orders = defaults.orders;
    changed = true;
  }
  if (isLegacyDemoMemberData(db)) {
    db.memberStats = defaults.memberStats;
    db.wallet = defaults.wallet;
    db.coupons = defaults.coupons;
    db.orders = defaults.orders;
    changed = true;
  }
  return changed;
}

dataStore = createDataStore({ dataDir, dbPath, seedPath, databaseUrl, normalizeDb });

async function readDb() {
  return dataStore.read();
}

async function writeDb(db) {
  await dataStore.write(db);
}

function withDbWrite(mutator) {
  const task = dbWriteQueue.then(async () => {
    const db = await readDb();
    const result = await mutator(db);
    await writeDb(db);
    return result;
  });
  dbWriteQueue = task.catch(() => {});
  return task;
}

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

function appendActivityEvent(db, activityId, type, payload = {}) {
  const sequence = db.activityEvents
    .filter(item => item.activityId === activityId)
    .reduce((max, item) => Math.max(max, Number(item.sequence || 0)), 0) + 1;
  const event = {
    id: createId('event'),
    activityId,
    sequence,
    type: String(type || 'update').slice(0, 40),
    payload,
    createdAt: nowIso()
  };
  db.activityEvents.push(event);
  return event;
}

function enqueueCreatorFollowerMessages(db, activity) {
  if (!activity.creatorOpenid) return [];
  const created = [];
  const followers = db.creatorSubscriptions.filter(item => item.creatorOpenid === activity.creatorOpenid);
  for (const follower of followers) {
    const duplicate = db.messages.some(item =>
      item.memberOpenid === follower.memberOpenid &&
      item.activityId === activity.id &&
      item.type === 'creator_activity'
    );
    if (duplicate) continue;
    const message = {
      id: createId('message'),
      memberOpenid: follower.memberOpenid,
      activityId: activity.id,
      type: 'creator_activity',
      title: '你订阅的发起人发布了新抽奖',
      content: `${activity.creator || activity.organizer || '抽奖发起人'}发起了“${activity.title}”`,
      status: 'unread',
      createdAt: nowIso()
    };
    db.messages.unshift(message);
    created.push(message);
  }
  return created;
}

function wechatPayConfigured() {
  return Boolean(
    wechatPayMchId &&
    wechatPaySerialNo &&
    (wechatPayPrivateKeyValue || wechatPayPrivateKeyPath) &&
    wechatPayApiV3Key.length === 32 &&
    wechatPayPlatformSerialNo &&
    (wechatPayPlatformPublicKeyValue || wechatPayPlatformPublicKeyPath) &&
    /^https:\/\//.test(wechatPayNotifyUrl)
  );
}

async function loadWechatPayPrivateKey() {
  if (cachedWechatPayPrivateKey) return cachedWechatPayPrivateKey;
  const source = wechatPayPrivateKeyValue || (wechatPayPrivateKeyPath
    ? await fs.readFile(path.resolve(wechatPayPrivateKeyPath), 'utf8')
    : '');
  if (!source) throw new Error('微信支付商户私钥未配置');
  cachedWechatPayPrivateKey = crypto.createPrivateKey(source);
  return cachedWechatPayPrivateKey;
}

async function loadWechatPayPlatformPublicKey() {
  if (cachedWechatPayPlatformPublicKey) return cachedWechatPayPlatformPublicKey;
  const source = wechatPayPlatformPublicKeyValue || (wechatPayPlatformPublicKeyPath
    ? await fs.readFile(path.resolve(wechatPayPlatformPublicKeyPath), 'utf8')
    : '');
  if (!source) throw new Error('微信支付平台公钥未配置');
  cachedWechatPayPlatformPublicKey = crypto.createPublicKey(source);
  return cachedWechatPayPlatformPublicKey;
}

function rsaWechatPaySign(privateKey, message) {
  return crypto.sign('RSA-SHA256', Buffer.from(message, 'utf8'), privateKey).toString('base64');
}

async function verifyWechatPayResponse(response, bodyText) {
  const timestamp = String(response.headers.get('wechatpay-timestamp') || '');
  const nonce = String(response.headers.get('wechatpay-nonce') || '');
  const signature = String(response.headers.get('wechatpay-signature') || '');
  const serial = String(response.headers.get('wechatpay-serial') || '');
  if (!timestamp || !nonce || !signature || serial !== wechatPayPlatformSerialNo) {
    throw new Error('微信支付响应签名参数无效');
  }
  const publicKey = await loadWechatPayPlatformPublicKey();
  const valid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${timestamp}\n${nonce}\n${bodyText}\n`, 'utf8'),
    publicKey,
    Buffer.from(signature, 'base64')
  );
  if (!valid) throw new Error('微信支付响应验签失败');
}

async function requestWechatPay(method, pathname, body = null) {
  if (!wechatPayConfigured()) {
    const error = new Error('微信支付商户能力尚未完成配置');
    error.status = 409;
    throw error;
  }
  const privateKey = await loadWechatPayPrivateKey();
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const bodyText = body === null ? '' : JSON.stringify(body);
  const signature = rsaWechatPaySign(privateKey, `${method}\n${pathname}\n${timestamp}\n${nonce}\n${bodyText}\n`);
  const authorization = [
    `mchid="${wechatPayMchId}"`,
    `nonce_str="${nonce}"`,
    `timestamp="${timestamp}"`,
    `serial_no="${wechatPaySerialNo}"`,
    `signature="${signature}"`
  ].join(',');
  const response = await fetch(`${wechatPayApiBaseUrl}${pathname}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `WECHATPAY2-SHA256-RSA2048 ${authorization}`,
      'User-Agent': 'lottery-tool/0.3'
    },
    ...(body === null ? {} : { body: bodyText })
  });
  const text = await response.text();
  await verifyWechatPayResponse(response, text);
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }
  if (!response.ok) {
    const error = new Error(payload.message || payload.code || '微信支付下单失败');
    error.status = 502;
    error.wechatCode = payload.code || '';
    throw error;
  }
  return payload;
}

async function buildMiniProgramPaymentParameters(prepayId) {
  const privateKey = await loadWechatPayPrivateKey();
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = crypto.randomBytes(16).toString('hex');
  const packageValue = `prepay_id=${prepayId}`;
  return {
    timeStamp,
    nonceStr,
    package: packageValue,
    signType: 'RSA',
    paySign: rsaWechatPaySign(privateKey, `${wechatAppId}\n${timeStamp}\n${nonceStr}\n${packageValue}\n`)
  };
}

async function verifyWechatPayNotification(req) {
  const timestamp = String(req.headers['wechatpay-timestamp'] || '');
  const nonce = String(req.headers['wechatpay-nonce'] || '');
  const signature = String(req.headers['wechatpay-signature'] || '');
  const serial = String(req.headers['wechatpay-serial'] || '');
  if (!timestamp || !nonce || !signature || serial !== wechatPayPlatformSerialNo) {
    throw new Error('微信支付回调签名参数无效');
  }
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    throw new Error('微信支付回调时间戳已过期');
  }
  const publicKey = await loadWechatPayPlatformPublicKey();
  const message = `${timestamp}\n${nonce}\n${req.rawBody || ''}\n`;
  const valid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(message, 'utf8'),
    publicKey,
    Buffer.from(signature, 'base64')
  );
  if (!valid) throw new Error('微信支付回调验签失败');

  const resource = req.body?.resource || {};
  const ciphertext = Buffer.from(String(resource.ciphertext || ''), 'base64');
  if (ciphertext.length <= 16) throw new Error('微信支付回调密文无效');
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(wechatPayApiV3Key, 'utf8'),
    Buffer.from(String(resource.nonce || ''), 'utf8')
  );
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(String(resource.associated_data || ''), 'utf8'));
  const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext);
}

function applyWechatPaymentTransaction(order, transaction) {
  if (transaction.trade_state !== 'SUCCESS') return false;
  if (transaction.appid !== wechatAppId || transaction.mchid !== wechatPayMchId) {
    throw new Error('微信支付交易商户信息不匹配');
  }
  if (transaction.out_trade_no !== order.paymentOutTradeNo) {
    throw new Error('微信支付交易单号与订单不匹配');
  }
  if (Number(transaction.amount?.total || 0) !== Number(order.amountCents || 0) ||
    String(transaction.amount?.currency || 'CNY') !== 'CNY') {
    throw new Error('支付金额与订单不一致');
  }
  if (transaction.payer?.openid !== order.memberOpenid) {
    throw new Error('支付用户与订单用户不一致');
  }
  if (!['paid', 'consumed'].includes(order.status)) {
    order.status = 'paid';
    order.paymentTransactionId = String(transaction.transaction_id || '');
    order.paidAt = String(transaction.success_time || nowIso());
    order.updatedAt = nowIso();
  }
  return true;
}

function publicPaymentOrder(order) {
  return {
    id: order.id,
    title: order.title,
    amount: Number(order.amount || 0),
    status: order.status,
    consumed: Boolean(order.consumedAt),
    activityId: order.activityId || '',
    createdAt: order.createdAt,
    paidAt: order.paidAt || null
  };
}

function ok(data) {
  return { code: 0, data };
}

function fail(res, status, message) {
  return res.status(status).json({ code: status, msg: message });
}

function requestClientKey(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.ip || req.socket?.remoteAddress || 'unknown');
}

function createRateLimiter({ windowMs, max }) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = requestClientKey(req);
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now
      ? { count: 0, resetAt: now + windowMs }
      : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    if (bucket.count > max) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return fail(res, 429, '请求过于频繁，请稍后再试');
    }
    return next();
  };
}

const loginRateLimiter = createRateLimiter({ windowMs: loginRateLimitWindowMs, max: loginRateLimitMax });
const activityActionRateLimiter = createRateLimiter({
  windowMs: activityActionRateLimitWindowMs,
  max: activityActionRateLimitMax
});

function getActivityBundle(db, activityId) {
  const activity = db.activities.find(item => item.id === activityId);
  if (!activity) return null;

  const prizes = db.prizes
    .filter(item => item.activityId === activityId)
    .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
  const participants = db.participants.filter(item => item.activityId === activityId);
  const winners = db.winners
    .filter(item => item.activityId === activityId)
    .map(item => {
      const prize = db.prizes.find(prizeItem => prizeItem.id === item.prizeId);
      const participant = db.participants.find(participantItem => participantItem.id === item.participantId);
      return { ...item, prize, participant };
    });
  const shares = db.shares.filter(item => item.activityId === activityId);
  const views = db.activityViews.filter(item => item.activityId === activityId);
  const comments = db.comments.filter(item => item.activityId === activityId && item.status !== 'hidden');
  const creatorSubscriptions = db.creatorSubscriptions.filter(item => item.creatorOpenid === activity.creatorOpenid);
  const participationApplications = db.participationApplications.filter(item => item.activityId === activityId);
  const assists = db.assists.filter(item => item.activityId === activityId);
  const checkIns = db.checkIns.filter(item => item.activityId === activityId);
  const activityTasks = db.activityTasks.filter(item => item.activityId === activityId);
  const activityEvents = db.activityEvents.filter(item => item.activityId === activityId);
  const subscriptions = db.subscriptions.filter(item => item.activityId === activityId);

  return {
    ...activity,
    prizes,
    participants,
    winners,
    shares,
    views,
    comments,
    creatorSubscriptions,
    participationApplications,
    assists,
    checkIns,
    activityTasks,
    activityEvents,
    subscriptions,
    metrics: {
      participantCount: participants.length,
      pendingReviewCount: participationApplications.filter(item => item.status === 'pending').length,
      assistCount: assists.length,
      viewCount: views.length,
      shareCount: shares.length,
      commentCount: comments.length,
      winnerCount: winners.length,
      prizeCount: prizes.reduce((sum, prize) => sum + Number(prize.quantity || 0), 0),
      remainingPrizeCount: prizes.reduce((sum, prize) => sum + Number(prize.remaining || 0), 0)
    }
  };
}

function isSampleActivity(activity) {
  return /^act_100[1-8]$/.test(String(activity?.id || ''));
}

function isPublicActivity(activity) {
  return Boolean(activity) && (!hideSampleData || !isSampleActivity(activity));
}

function isHomeActivityAvailable(activity, timestamp = Date.now()) {
  if (!isPublicActivity(activity) || activity.status !== 'live') return false;
  const drawTimestamp = new Date(activity.drawAt).getTime();
  return Number.isFinite(drawTimestamp) && drawTimestamp > timestamp;
}

function maskedNickname(value) {
  const characters = Array.from(String(value || '').trim() || '用户');
  if (characters.length === 1) return `${characters[0]}***`;
  return `${characters[0]}***${characters[characters.length - 1]}`;
}

function publicParticipant(participant) {
  return {
    nickname: maskedNickname(participant.nickname),
    avatarColor: participant.avatarColor || '#c80f2e',
    createdAt: participant.createdAt
  };
}

function assistStats(db, activity, participantId) {
  const conditions = normalizeParticipationConditions(activity?.conditions);
  const rawCount = db.assists.filter(item =>
    item.activityId === activity.id && item.targetParticipantId === participantId
  ).length;
  const effectiveCount = conditions.assist
    ? Math.min(rawCount, conditions.assistLimit)
    : 0;
  return {
    rawCount,
    effectiveCount,
    drawWeight: conditions.assist
      ? 1 + effectiveCount * conditions.assistWeight
      : 1
  };
}

function checkInStats(db, activity, participant) {
  const conditions = normalizeParticipationConditions(activity?.conditions);
  if (!participant || !conditions.checkIn || !conditions.checkInTask) {
    return { record: null, completed: false, bonusWeight: 1 };
  }
  const record = db.checkIns.find(item => (
    item.activityId === activity.id &&
    item.memberOpenid === participant.memberOpenid &&
    item.taskId === conditions.checkInTask.id
  ));
  return {
    record: record || null,
    completed: record?.status === 'completed',
    bonusWeight: checkInRewardWeight(record)
  };
}

function participantDrawStats(db, activity, participant) {
  const assist = assistStats(db, activity, participant.id);
  const checkIn = checkInStats(db, activity, participant);
  return {
    ...assist,
    checkIn,
    drawWeight: Math.max(1, Math.min(5_000, assist.drawWeight * checkIn.bonusWeight))
  };
}

function normalizeRegionConfig(source = {}) {
  const latitude = Number(source?.latitude);
  const longitude = Number(source?.longitude);
  const radiusMeters = Math.max(100, Math.min(50_000, Math.round(Number(source?.radiusMeters || 1000))));
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return null;
  }
  return {
    name: String(source?.name || '指定区域').trim().slice(0, 80),
    latitude,
    longitude,
    radiusMeters
  };
}

function normalizeSurveyQuestions(source = []) {
  if (!Array.isArray(source)) return [];
  return source.slice(0, 10).map((item, index) => ({
    id: String(item?.id || `question_${index + 1}`).trim().slice(0, 64),
    title: String(item?.title || '').trim().slice(0, 100),
    required: item?.required !== false
  })).filter(item => item.title);
}

function normalizeTextOptions(source = []) {
  if (!Array.isArray(source)) return [];
  return [...new Set(source.map(item => String(item || '').trim().slice(0, 80)).filter(Boolean))].slice(0, 8);
}

const CHECK_IN_TASK_SPECS = Object.freeze({
  timed: { title: '完成限时打卡', durationSeconds: 15 },
  miniProgram: { title: '体验小程序', durationSeconds: 15 },
  officialArticle: { title: '浏览指定公众号文章', durationSeconds: 15 },
  image: { title: '浏览图片', durationSeconds: 6 },
  channelsVideo: { title: '浏览视频号视频', durationSeconds: 15 }
});

function normalizeCheckInTask(source) {
  const input = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const type = String(input.type || '').trim();
  const spec = CHECK_IN_TASK_SPECS[type];
  if (!spec) return null;
  const hasRewardConfig = ['rewardMode', 'rewardMin', 'rewardMax']
    .some(key => Object.prototype.hasOwnProperty.call(input, key));
  const rewardMode = hasRewardConfig && input.rewardMode !== 'fixed' ? 'random' : 'fixed';
  const normalizeRewardValue = (value, fallback) => {
    const parsed = Math.round(Number(value));
    return Number.isFinite(parsed) ? Math.max(1, Math.min(10, parsed)) : fallback;
  };
  let rewardMin = hasRewardConfig
    ? normalizeRewardValue(input.rewardMin, 1)
    : 2;
  let rewardMax = hasRewardConfig
    ? Math.max(rewardMin, normalizeRewardValue(input.rewardMax, rewardMin))
    : 2;
  if (rewardMode === 'fixed') {
    rewardMin = rewardMax;
  }
  const title = String(input.title || spec.title).trim().slice(0, 40) || spec.title;
  const rawDurationSeconds = Math.round(Number(input.durationSeconds));
  const durationSeconds = type === 'timed' && Number.isFinite(rawDurationSeconds)
    ? Math.max(3, Math.min(300, rawDurationSeconds))
    : spec.durationSeconds;
  const miniProgramLink = String(input.miniProgramLink || '').trim().slice(0, 500);
  const task = {
    type,
    title,
    durationSeconds,
    linkMode: input.linkMode === 'link' || miniProgramLink ? 'link' : 'path',
    miniProgramLink,
    appId: String(input.appId || '').trim().slice(0, 32),
    path: String(input.path || '').trim().slice(0, 200),
    guideText: String(input.guideText || `完成${title}，增加中奖率`).trim().slice(0, 80),
    rewardMode,
    rewardMin,
    rewardMax,
    articleUrl: String(input.articleUrl || '').trim().slice(0, 500),
    image: String(input.image || '').trim().slice(0, 500),
    finderUserName: String(input.finderUserName || '').trim().slice(0, 120),
    feedId: String(input.feedId || '').trim().slice(0, 200)
  };
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(task)).digest('hex').slice(0, 20);
  return { id: `checkin_${fingerprint}`, ...task };
}

function isCheckInTaskConfigured(task) {
  if (!task) return false;
  if (task.type === 'timed') {
    return Boolean(String(task.title || '').trim() && String(task.guideText || '').trim());
  }
  if (task.type === 'miniProgram') {
    return task.linkMode === 'link'
      ? /^#小程序:\/\/[^/\s]+\/\S+$/.test(task.miniProgramLink)
      : /^wx[0-9a-fA-F]{16}$/.test(task.appId);
  }
  if (task.type === 'officialArticle') return /^https:\/\//i.test(task.articleUrl);
  if (task.type === 'image') return /^(?:https?:\/\/|\/)/i.test(task.image);
  if (task.type === 'channelsVideo') return Boolean(task.finderUserName && task.feedId);
  return false;
}

function checkInRewardWeight(record) {
  if (record?.status !== 'completed') return 1;
  const storedWeight = Math.round(Number(record.rewardMultiplier));
  return Number.isFinite(storedWeight) ? Math.max(1, Math.min(10, storedWeight)) : 2;
}

function createCheckInRewardWeight(task) {
  const rawMin = Math.round(Number(task?.rewardMin));
  const min = Number.isFinite(rawMin) ? Math.max(1, Math.min(10, rawMin)) : 1;
  const rawMax = Math.round(Number(task?.rewardMax));
  const max = Number.isFinite(rawMax) ? Math.max(min, Math.min(10, rawMax)) : min;
  return task?.rewardMode === 'fixed' ? max : crypto.randomInt(min, max + 1);
}

function publicCheckInTaskProgress(record, task) {
  return {
    task: publicCheckInTask(task),
    status: record?.status || 'not_started',
    startedAt: record?.startedAt || null,
    readyAt: record?.readyAt || null,
    completedAt: record?.completedAt || null,
    bonusWeight: checkInRewardWeight(record)
  };
}

function publicCheckInTask(task) {
  if (!task) return null;
  return {
    id: task.id,
    type: task.type,
    title: task.title,
    durationSeconds: task.durationSeconds,
    guideText: task.guideText,
    rewardMode: task.rewardMode,
    rewardMin: task.rewardMin,
    rewardMax: task.rewardMax
  };
}

function digestConditionValue(value, caseInsensitive = false) {
  const normalized = String(value || '').trim();
  return crypto.createHash('sha256').update(caseInsensitive ? normalized.toLocaleLowerCase('zh-CN') : normalized).digest('hex');
}

function normalizeParticipationConditions(source = {}) {
  const input = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const conditions = {};
  for (const key of [
    'checkIn',
    'assist',
    'groupOnly',
    'fansOnly',
    'review',
    'wecom',
    'region',
    'passcode',
    'survey',
    'task',
    'answer',
    'vote'
  ]) {
    conditions[key] = Boolean(input[key]);
  }
  conditions.groupType = input.groupType === 'wecom' ? 'wecom' : 'wechat';
  if (input.enterpriseId) conditions.enterpriseId = String(input.enterpriseId).trim();
  if (input.enterpriseName) conditions.enterpriseName = String(input.enterpriseName).trim();
  conditions.regionConfig = normalizeRegionConfig(input.regionConfig);
  conditions.surveyQuestions = normalizeSurveyQuestions(input.surveyQuestions);
  conditions.officialAccountAppId = String(input.officialAccountAppId || '').trim();
  conditions.officialAccountName = String(input.officialAccountName || '').trim().slice(0, 80);
  conditions.officialAccountUsername = String(input.officialAccountUsername || '').trim().slice(0, 120);
  conditions.wecomCorpId = String(input.wecomCorpId || '').trim();
  conditions.wecomName = String(input.wecomName || '').trim().slice(0, 80);
  conditions.reviewPrompt = String(input.reviewPrompt || '').trim().slice(0, 160);
  conditions.assistWeight = Math.max(1, Math.min(10, Math.round(Number(input.assistWeight || 1))));
  conditions.assistLimit = Math.max(1, Math.min(50, Math.round(Number(input.assistLimit || 5))));
  conditions.passcodeValue = String(input.passcodeValue || '').trim().slice(0, 32);
  conditions.passcodeHash = String(input.passcodeHash || '').trim();
  conditions.taskText = String(input.taskText || '').trim().slice(0, 160);
  conditions.taskDurationSeconds = Math.max(3, Math.min(3600, Math.round(Number(input.taskDurationSeconds || 15))));
  conditions.taskProofRequired = input.taskProofRequired !== false;
  conditions.answerQuestion = String(input.answerQuestion || '').trim().slice(0, 120);
  conditions.answerValue = String(input.answerValue || '').trim().slice(0, 120);
  conditions.answerHash = String(input.answerHash || '').trim();
  conditions.voteQuestion = String(input.voteQuestion || '').trim().slice(0, 120);
  conditions.voteOptions = normalizeTextOptions(input.voteOptions);
  conditions.checkInTask = normalizeCheckInTask(input.checkInTask);
  return conditions;
}

function normalizeSupportedCreateConditions(source = {}) {
  const conditions = normalizeParticipationConditions(source);
  conditions.passcode = false;
  conditions.passcodeValue = '';
  conditions.passcodeHash = '';
  return conditions;
}

function normalizePromotion(source = {}) {
  const input = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  return {
    encourageShare: Boolean(input.encourageShare),
    platformRecommend: Boolean(input.platformRecommend),
    hideShareButton: Boolean(input.hideShareButton)
  };
}

function normalizeActivityIdList(source) {
  if (!Array.isArray(source)) return [];
  return [...new Set(source
    .map(item => String(item || '').trim())
    .filter(Boolean))].slice(0, 20);
}

function normalizeAdvanced(source = {}) {
  const input = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  return {
    enabled: Boolean(input.enabled),
    cleanDisplay: Boolean(input.cleanDisplay),
    exclusiveLanding: Boolean(input.exclusiveLanding),
    analytics: Boolean(input.analytics),
    blockHighRisk: Boolean(input.blockHighRisk),
    comments: Boolean(input.comments),
    futureSubscription: Boolean(input.futureSubscription),
    recentWinnerBlock: Boolean(input.recentWinnerBlock),
    recentWinnerDays: Math.max(1, Math.min(30, Math.round(Number(input.recentWinnerDays || 30)))),
    recentWinnerActivityIds: normalizeActivityIdList(input.recentWinnerActivityIds)
  };
}

function normalizeSpecialConfig(source = {}) {
  const input = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const annualInput = input.annual && typeof input.annual === 'object' && !Array.isArray(input.annual)
    ? input.annual
    : null;
  const candidateSource = Array.isArray(annualInput?.candidateNames)
    ? annualInput.candidateNames
    : String(annualInput?.candidateNames || '').split(/[,，\n]/);
  const candidateNames = [...new Set(candidateSource
    .map(item => String(item || '').trim())
    .filter(Boolean))].slice(0, 200);
  const candidateIdSource = Array.isArray(annualInput?.candidateUnionIds)
    ? annualInput.candidateUnionIds
    : String(annualInput?.candidateUnionIds || '').split(/[,，\n]/);
  const candidateUnionIds = [...new Set(candidateIdSource
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .map(item => item.slice(0, 128)))].slice(0, 500);
  return {
    styleKey: String(input.styleKey || '').trim().slice(0, 40),
    styleName: String(input.styleName || '').trim().slice(0, 40),
    annualReverseDraw: Boolean(input.annualReverseDraw),
    annual: annualInput ? {
      companyName: String(annualInput.companyName || '').trim().slice(0, 80),
      activityTheme: String(annualInput.activityTheme || '').trim().slice(0, 80),
      brandLogo: String(annualInput.brandLogo || '').trim().slice(0, 500),
      backgroundImage: String(annualInput.backgroundImage || '').trim().slice(0, 500),
      showWinnerContact: Boolean(annualInput.showWinnerContact),
      candidateNames,
      candidateUnionIds,
      onlyWecom: Boolean(annualInput.onlyWecom)
    } : null,
    fun: input.fun && typeof input.fun === 'object' && !Array.isArray(input.fun)
      ? { randomPrize: Boolean(input.fun.randomPrize) }
      : null
  };
}

function publicSpecialConfig(source = {}, includePrivate = false) {
  const config = normalizeSpecialConfig(source);
  if (!config.annual) return config;
  return {
    ...config,
    annual: {
      ...config.annual,
      candidateCount: config.annual.candidateUnionIds.length || config.annual.candidateNames.length,
      candidateUnionIdCount: config.annual.candidateUnionIds.length,
      candidateNames: includePrivate ? config.annual.candidateNames : []
    }
  };
}

function publicParticipationConditions(source = {}) {
  const conditions = normalizeParticipationConditions(source);
  const hasCheckInTask = conditions.checkIn && isCheckInTaskConfigured(conditions.checkInTask);
  return {
    ...(hasCheckInTask ? { checkIn: true, checkInTask: publicCheckInTask(conditions.checkInTask) } : {}),
    assist: conditions.assist,
    assistWeight: conditions.assistWeight,
    assistLimit: conditions.assistLimit,
    groupOnly: conditions.groupOnly,
    groupType: conditions.groupType,
    enterpriseName: conditions.enterpriseName || '',
    fansOnly: conditions.fansOnly,
    officialAccountName: conditions.officialAccountName || '',
    officialAccountUsername: conditions.officialAccountUsername || '',
    review: conditions.review,
    reviewPrompt: conditions.reviewPrompt,
    wecom: conditions.wecom,
    wecomName: conditions.wecomName || '',
    region: conditions.region,
    regionConfig: conditions.regionConfig,
    survey: conditions.survey,
    surveyQuestions: conditions.surveyQuestions,
    task: conditions.task,
    taskText: conditions.taskText,
    ...(conditions.task ? { taskDurationSeconds: conditions.taskDurationSeconds } : {}),
    ...(conditions.task ? { taskProofRequired: conditions.taskProofRequired } : {}),
    answer: conditions.answer,
    answerQuestion: conditions.answerQuestion,
    vote: conditions.vote,
    voteQuestion: conditions.voteQuestion,
    voteOptions: conditions.voteOptions
  };
}

function publicActivity(bundle, member = null) {
  const participant = member
    ? bundle.participants.find(item => item.memberOpenid === member.openid)
    : null;
  const application = member
    ? bundle.participationApplications.find(item => item.memberOpenid === member.openid)
    : null;
  const joinStatus = participant ? 'joined' : (application?.status || 'none');
  const normalizedConditions = normalizeParticipationConditions(bundle.conditions);
  const advanced = normalizeAdvanced(bundle.advanced);
  const taskRecord = member && normalizedConditions.task
    ? bundle.activityTasks.find(item => item.memberOpenid === member.openid)
    : null;
  const isCreator = Boolean(member && member.openid === bundle.creatorOpenid);
  const exclusiveLeadVisible = !advanced.enabled || !advanced.exclusiveLanding || Boolean(participant) || isCreator;
  const promotion = normalizePromotion(bundle.promotion);
  const participantStats = participant ? participantDrawStats(bundle, bundle, participant) : null;
  if (advanced.enabled && advanced.cleanDisplay) promotion.platformRecommend = false;
  return {
    id: bundle.id,
    title: bundle.title,
    subtitle: bundle.subtitle,
    coverText: bundle.coverText,
    description: bundle.description,
    organizer: bundle.organizer || '抽奖工具',
    organizerVerified: bundle.organizerVerified !== false,
    image: bundle.image || '/assets/cover-phone.svg',
    sponsorText: bundle.sponsorText || '',
    leadInfo: exclusiveLeadVisible ? (bundle.leadInfo || '') : '',
    exclusiveLeadVisible,
    displayMode: advanced.enabled && advanced.cleanDisplay ? 'clean' : 'standard',
    introImages: Array.isArray(bundle.introImages) ? bundle.introImages : [],
    status: bundle.status,
    startAt: bundle.startAt,
    endAt: bundle.endAt,
    drawAt: bundle.drawAt,
    drawMode: bundle.drawMode || 'time',
    drawParticipantTarget: Number(bundle.drawParticipantTarget || 0),
    unlockByPeople: Boolean(bundle.unlockByPeople),
    instantPerUserLimit: Math.max(1, Number(bundle.instantPerUserLimit || 1)),
    instantParticipantLimit: Math.max(5, Number(bundle.instantParticipantLimit || 5)),
    instantAttemptsUsed: participant ? Math.max(0, Number(participant.attemptCount || 0)) : 0,
    instantAttemptsRemaining: participant
      ? Math.max(0, Number(bundle.instantPerUserLimit || 1) - Number(participant.attemptCount || 0))
      : Math.max(1, Number(bundle.instantPerUserLimit || 1)),
    templateType: bundle.templateType || '新样式',
    specialConfig: publicSpecialConfig(bundle.specialConfig, Boolean(member && member.openid === bundle.creatorOpenid)),
    homePlacement: bundle.homePlacement || '',
    promotion,
    advanced,
    conditions: publicParticipationConditions(bundle.conditions),
    rule: bundle.rule,
    shareTitle: bundle.shareTitle,
    prizes: bundle.prizes,
    participants: [...bundle.participants]
      .sort((left, right) => (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0))
      .slice(0, 20)
      .map(publicParticipant),
    joined: Boolean(participant),
    joinStatus,
    taskProgress: normalizedConditions.task ? {
      status: taskRecord?.status || 'not_started',
      startedAt: taskRecord?.startedAt || null,
      readyAt: taskRecord?.readyAt || null,
      completedAt: taskRecord?.completedAt || null,
      submittedAt: taskRecord?.submittedAt || null,
      reviewedAt: taskRecord?.reviewedAt || null,
      reviewNote: taskRecord?.reviewNote || '',
      proofImage: taskRecord?.proofImage || '',
      proofNote: taskRecord?.proofNote || ''
    } : null,
    checkInProgress: normalizedConditions.checkIn
      ? publicCheckInTaskProgress(participantStats?.checkIn.record, normalizedConditions.checkInTask)
      : null,
    participantId: participant?.id || '',
    application: application ? {
      id: application.id,
      status: application.status,
      reviewNote: application.reviewNote || '',
      updatedAt: application.updatedAt
    } : null,
    assistCount: participantStats?.rawCount || 0,
    effectiveAssistCount: participantStats?.effectiveCount || 0,
    drawWeight: participantStats?.drawWeight || 1,
    subscribedToCreator: Boolean(member && bundle.creatorSubscriptions.some(item => item.memberOpenid === member.openid)),
    reminderEnabled: Boolean(member && bundle.subscriptions.some(item => (
      item.openid === member.openid
      && (item.type === 'draw_reminder' || item.type === 'cash')
      && item.status === 'accepted'
      && !item.sentAt
    ))),
    metrics: bundle.metrics,
    comments: bundle.comments
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 30)
      .map(item => ({
        id: item.id,
        nickname: item.nickname || '微信用户',
        content: item.content,
        createdAt: item.createdAt
      })),
    winners: bundle.winners.map(winner => ({
      id: winner.id,
      prizeName: winner.prize?.name || '',
      prizeLevel: winner.prize?.level || '',
      nickname: winner.participant?.nickname || '用户',
      avatarColor: winner.participant?.avatarColor || '#c80f2e',
      claimed: winner.claimed,
      revealMode: winner.revealMode || 'standard',
      resultCode: winner.resultCode || '',
      createdAt: winner.createdAt
    })),
    events: bundle.activityEvents
      .sort((a, b) => Number(a.sequence || 0) - Number(b.sequence || 0))
      .slice(-50)
      .map(item => ({
        id: item.id,
        sequence: item.sequence,
        type: item.type,
        payload: item.payload,
        createdAt: item.createdAt
      }))
  };
}

function normalizeActivityInput(body, fallbackTitle = '') {
  const title = String(body.title || fallbackTitle || '').trim();
  const defaultDrawAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  return {
    title,
    subtitle: String(body.subtitle || '抽奖工具官方活动').trim(),
    coverText: String(body.coverText || '配置奖品后即可邀请用户参与。').trim(),
    description: String(body.description || '用户通过微信便捷登录参与，后台可统一开奖并核销中奖记录。').trim(),
    organizer: String(body.organizer || '抽奖工具').trim(),
    organizerVerified: body.organizerVerified === undefined ? true : Boolean(body.organizerVerified),
    image: String(body.image || '/assets/cover-phone.svg').trim(),
    sponsorText: String(body.sponsorText || '').trim(),
    leadInfo: String(body.leadInfo || '').trim(),
    introImages: Array.isArray(body.introImages)
      ? body.introImages.map(item => String(item || '').trim()).filter(Boolean).slice(0, 9)
      : [],
    status: body.status || 'draft',
    startAt: body.startAt || nowIso(),
    endAt: body.endAt || body.drawAt || defaultDrawAt,
    drawAt: body.drawAt || defaultDrawAt,
    drawMode: ['time', 'people', 'instant'].includes(body.drawMode) ? body.drawMode : 'time',
    drawParticipantTarget: Math.max(0, Math.min(999999, Number(body.drawParticipantTarget || 0))),
    unlockByPeople: Boolean(body.unlockByPeople),
    instantPerUserLimit: Math.max(1, Math.min(5, Math.floor(Number(body.instantPerUserLimit || 1)))),
    instantParticipantLimit: Math.max(5, Math.min(10000, Math.floor(Number(body.instantParticipantLimit || 5)))),
    instantAttemptCount: Math.max(0, Math.floor(Number(body.instantAttemptCount || 0))),
    autoDraw: Boolean(body.autoDraw),
    templateType: String(body.templateType || '').trim(),
    specialConfig: normalizeSpecialConfig(body.specialConfig),
    homePlacement: ['official', 'cash', 'daily'].includes(body.homePlacement) ? body.homePlacement : '',
    homePriority: Math.max(0, Math.min(9999, Math.round(Number(body.homePriority || 0)))),
    promotion: normalizePromotion(body.promotion),
    advanced: normalizeAdvanced(body.advanced),
    conditions: normalizeSupportedCreateConditions(body.conditions),
    rule: String(body.rule || '每人限参与一次，到点后自动开奖。').trim(),
    shareTitle: String(body.shareTitle || title).trim()
  };
}

function sessionMember(db, req) {
  const sessionId = requestBearerToken(req);
  if (!sessionId) return null;
  const session = db.sessions.find(item => item.id === sessionId);
  if (!session) return null;
  if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) return null;
  return db.members.find(item => item.openid === session.openid) || null;
}

function defaultMemberCenter(db, member = null) {
  const defaults = dbDefaults();
  if (!member) {
    return {
      authenticated: false,
      profile: null,
      stats: { ...defaults.memberStats },
      wallet: { ...defaults.wallet, records: [] },
      coupons: [],
      orders: []
    };
  }
  const createdActivities = db.activities.filter(item => item.creatorOpenid === member.openid);
  const joinedParticipants = db.participants.filter(item => item.memberOpenid === member.openid);
  const joinedActivityIds = new Set(joinedParticipants.map(item => item.activityId));
  const createdActivityIds = new Set(createdActivities.map(item => item.id));
  const winnerParticipantIds = new Set(
    db.winners
      .filter(item => joinedParticipants.some(participant => participant.id === item.participantId))
      .map(item => item.participantId)
  );
  const memberWalletRecords = db.wallet.records.filter(item => item.memberOpenid === member.openid);
  const memberCoupons = db.coupons.filter(item => item.memberOpenid === member.openid);
  const memberOrders = db.orders.filter(item => item.memberOpenid === member.openid);
  return {
    authenticated: true,
    profile: publicMemberProfile(member),
    stats: {
      total: new Set([...createdActivityIds, ...joinedActivityIds]).size,
      created: createdActivityIds.size,
      won: winnerParticipantIds.size
    },
    wallet: {
      balance: memberWalletRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      frozen: memberWalletRecords
        .filter(item => item.status === 'frozen' || item.status === 'pending')
        .reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0),
      records: memberWalletRecords
    },
    coupons: memberCoupons,
    orders: memberOrders
  };
}

function publicMemberProfile(member, fallbackNickname = '微信用户') {
  return {
    nickname: member?.nickname || fallbackNickname,
    level: Number(member?.level || 2),
    avatar: member?.avatar || '/assets/avatar-default.svg',
    profileCompleted: member?.profileCompleted === true
  };
}

function creatorRoleAllows(role, permission) {
  const permissions = {
    manager: ['read', 'manage', 'claim'],
    verifier: ['read', 'claim'],
    viewer: ['read']
  };
  return (permissions[role] || []).includes(permission);
}

function hasCreatorPermission(db, member, creatorOpenid, permission = 'read') {
  if (!member || !creatorOpenid) return false;
  if (member.openid === creatorOpenid) return true;
  return db.creatorTeamMembers.some(item =>
    item.creatorOpenid === creatorOpenid &&
    item.memberOpenid === member.openid &&
    item.status === 'active' &&
    creatorRoleAllows(item.role, permission)
  );
}

function creatorActivitySummary(db, activity) {
  const participantCount = db.participants.filter(item => item.activityId === activity.id).length;
  const winners = db.winners.filter(item => item.activityId === activity.id);
  return {
    id: activity.id,
    title: activity.title,
    image: activity.image || '/assets/cover-phone.svg',
    status: activity.status,
    drawMode: activity.drawMode || 'time',
    drawAt: activity.drawAt,
    createdAt: activity.createdAt,
    updatedAt: activity.updatedAt,
    participantCount,
    winnerCount: winners.length,
    pendingClaimCount: winners.filter(item => item.claimed !== true).length,
    creatorOpenid: activity.creatorOpenid
  };
}

function creatorDashboardCounts(db, member) {
  if (!member) {
    return {
      activityCount: 0,
      liveCount: 0,
      draftCount: 0,
      pendingClaimCount: 0,
      teamCount: 0,
      blacklistCount: 0,
      authorizationCount: 0,
      prizeCount: 0
    };
  }
  const ownActivities = db.activities.filter(item => item.creatorOpenid === member.openid);
  const ownActivityIds = new Set(ownActivities.map(item => item.id));
  const joinedParticipantIds = new Set(db.participants
    .filter(item => item.memberOpenid === member.openid)
    .map(item => item.id));
  return {
    activityCount: ownActivities.length,
    liveCount: ownActivities.filter(item => item.status === 'live').length,
    draftCount: ownActivities.filter(item => item.status === 'draft').length,
    pendingClaimCount: db.winners.filter(item => ownActivityIds.has(item.activityId) && item.claimed !== true).length,
    teamCount: db.creatorTeamMembers.filter(item => item.creatorOpenid === member.openid && item.status !== 'removed').length,
    blacklistCount: db.creatorBlacklists.filter(item => item.creatorOpenid === member.openid && item.status !== 'removed').length,
    authorizationCount: db.officialAccountAuthorizations.filter(item => item.memberOpenid === member.openid && item.status === 'active').length,
    prizeCount: db.winners.filter(item => joinedParticipantIds.has(item.participantId)).length
  };
}

async function exchangeWechatCode(code) {
  if (!wechatAppId || !wechatAppSecret) {
    const error = new Error('微信登录服务未配置 AppID 或 AppSecret');
    error.status = 503;
    throw error;
  }

  const url = new URL(code2SessionUrl);
  url.searchParams.set('appid', wechatAppId);
  url.searchParams.set('secret', wechatAppSecret);
  url.searchParams.set('js_code', code);
  url.searchParams.set('grant_type', 'authorization_code');

  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error('微信登录服务请求失败');
    error.status = 502;
    throw error;
  }
  const payload = await response.json();
  if (payload.errcode) {
    const error = new Error(payload.errmsg || '微信登录凭证校验失败');
    error.status = 502;
    throw error;
  }
  if (!payload.openid) {
    const error = new Error('微信登录未返回 openid');
    error.status = 502;
    throw error;
  }
  return payload;
}

function decryptWechatGroupInfo(sessionKey, encryptedData, iv) {
  try {
    const key = Buffer.from(String(sessionKey || ''), 'base64');
    const vector = Buffer.from(String(iv || ''), 'base64');
    if (key.length !== 16 || vector.length !== 16) throw new Error('invalid key material');
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, vector);
    decipher.setAutoPadding(true);
    const clear = Buffer.concat([
      decipher.update(Buffer.from(String(encryptedData || ''), 'base64')),
      decipher.final()
    ]).toString('utf8');
    const payload = JSON.parse(clear);
    const openGId = String(payload.openGId || payload.opengid || '').trim();
    if (!openGId) throw new Error('missing openGId');
    if (payload.watermark?.appid && payload.watermark.appid !== wechatAppId) {
      throw new Error('appid mismatch');
    }
    return { openGId };
  } catch {
    const error = new Error('微信群身份信息校验失败，请从目标微信群重新打开小程序');
    error.status = 400;
    throw error;
  }
}

function groupProofSigningKey() {
  return crypto.createHash('sha256')
    .update(`lottery-group-proof:${wechatAppSecret}`)
    .digest();
}

function signGroupProof({ openid, openGId }) {
  const body = Buffer.from(JSON.stringify({
    openid,
    openGId,
    expiresAt: Date.now() + groupProofLifetimeMs
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', groupProofSigningKey()).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyGroupProof(token, expectedOpenid) {
  try {
    const [body, signature] = String(token || '').split('.');
    if (!body || !signature) throw new Error('invalid token');
    const expected = crypto.createHmac('sha256', groupProofSigningKey()).update(body).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      throw new Error('invalid signature');
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.openid !== expectedOpenid || !payload.openGId || Number(payload.expiresAt) <= Date.now()) {
      throw new Error('expired proof');
    }
    return payload;
  } catch {
    const error = new Error('请从活动指定微信群重新打开小程序后参与');
    error.status = 403;
    throw error;
  }
}

function bindGroupRestriction(conditions, proofToken, member, db) {
  const normalized = normalizeParticipationConditions(conditions);
  if (!normalized.groupOnly) return normalized;
  if (normalized.groupType === 'wecom') {
    if (!integrationCapabilities().wecom.configured) {
      const error = new Error('企业微信客户群校验尚未在服务器完成配置');
      error.status = 409;
      throw error;
    }
    const group = db?.wecomGroups?.find(item =>
      item.corpId === wecomCorpId && item.id === normalized.enterpriseId
    );
    if (!group) {
      const error = new Error('请选择已同步的企业微信客户群');
      error.status = 400;
      throw error;
    }
    return {
      ...normalized,
      groupType: 'wecom',
      wecomCorpId,
      allowedWecomGroupId: group.id,
      enterpriseName: group.name
    };
  }
  const proof = verifyGroupProof(proofToken, member.openid);
  return {
    ...normalized,
    groupType: 'wechat',
    allowedGroupOpenGid: proof.openGId
  };
}

function integrationCapabilities() {
  return {
    officialAccount: {
      configured: Boolean(officialAccountAppId && officialAccountAppSecret && officialAccountToken && officialAccountName),
      name: officialAccountName,
      username: officialAccountUsername,
      authorizationEnabled: wechatOpenPlatformConfigured()
    },
    wecom: {
      configured: Boolean(wecomCorpId && wecomContactSecret && wecomName),
      name: wecomName
    },
    subscriptionTemplates: {
      drawReminder: subscriptionTemplateCapability('draw_reminder'),
      drawResult: subscriptionTemplateCapability('draw_result'),
      cash: subscriptionTemplateCapability('cash'),
      comment: subscriptionTemplateCapability('comment')
    }
  };
}

function publicMiniProgramEntry() {
  const launchUrl = /^https:\/\//i.test(miniProgramLaunchUrl) ? miniProgramLaunchUrl : '';
  return {
    ready: Boolean(launchUrl),
    launchUrl,
    appId: wechatAppId
  };
}

function wechatOpenPlatformConfigured() {
  return Boolean(
    wechatOpenComponentAppId &&
    wechatOpenComponentAppSecret &&
    wechatOpenComponentToken &&
    wechatOpenComponentAesKey.length === 43 &&
    /^https:\/\//.test(wechatOpenAuthRedirectUrl)
  );
}

function wechatOpenStateSigningKey() {
  return crypto.createHash('sha256')
    .update(`lottery-wechat-open:${wechatOpenComponentAppSecret}`)
    .digest();
}

function signWechatOpenState(memberOpenid) {
  const body = Buffer.from(JSON.stringify({
    memberOpenid,
    nonce: crypto.randomBytes(12).toString('hex'),
    expiresAt: Date.now() + 15 * 60 * 1000
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', wechatOpenStateSigningKey())
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
}

function verifyWechatOpenState(value) {
  try {
    const [body, signature] = String(value || '').split('.');
    if (!body || !signature) throw new Error('missing state');
    const expected = crypto.createHmac('sha256', wechatOpenStateSigningKey()).update(body).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      throw new Error('invalid signature');
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.memberOpenid || Number(payload.expiresAt) <= Date.now()) throw new Error('expired state');
    return payload;
  } catch {
    const error = new Error('公众号授权请求已失效，请返回小程序重新发起');
    error.status = 400;
    throw error;
  }
}

function secureHexEquals(expected, actual) {
  const expectedBuffer = Buffer.from(String(expected || ''), 'utf8');
  const actualBuffer = Buffer.from(String(actual || ''), 'utf8');
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function decryptWechatOpenMessage(rawBody, query = {}) {
  if (!wechatOpenPlatformConfigured()) {
    const error = new Error('微信开放平台第三方平台尚未配置');
    error.status = 409;
    throw error;
  }
  const parser = new XMLParser({ ignoreAttributes: true, trimValues: true, parseTagValue: false });
  const envelope = parser.parse(String(rawBody || '')).xml || {};
  const encrypted = String(envelope.Encrypt || '').trim();
  if (!encrypted) throw new Error('微信开放平台回调缺少密文');
  const expectedSignature = crypto.createHash('sha1')
    .update([
      wechatOpenComponentToken,
      String(query.timestamp || ''),
      String(query.nonce || ''),
      encrypted
    ].sort().join(''))
    .digest('hex');
  if (!secureHexEquals(expectedSignature, query.msg_signature)) {
    const error = new Error('微信开放平台回调签名无效');
    error.status = 403;
    throw error;
  }
  const aesKey = Buffer.from(`${wechatOpenComponentAesKey}=`, 'base64');
  if (aesKey.length !== 32) throw new Error('微信开放平台消息加密密钥无效');
  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, aesKey.subarray(0, 16));
  decipher.setAutoPadding(false);
  let clear = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final()
  ]);
  const padding = clear[clear.length - 1];
  if (!padding || padding > 32 || padding > clear.length) throw new Error('微信开放平台回调填充无效');
  clear = clear.subarray(0, clear.length - padding);
  if (clear.length < 20) throw new Error('微信开放平台回调内容无效');
  const messageLength = clear.readUInt32BE(16);
  const messageStart = 20;
  const messageEnd = messageStart + messageLength;
  if (messageEnd > clear.length) throw new Error('微信开放平台回调长度无效');
  const messageXml = clear.subarray(messageStart, messageEnd).toString('utf8');
  const receiverAppId = clear.subarray(messageEnd).toString('utf8');
  if (receiverAppId !== wechatOpenComponentAppId) throw new Error('微信开放平台回调 AppID 不匹配');
  return parser.parse(messageXml).xml || {};
}

async function requestWechatOpenApi(pathname, body) {
  const response = await fetch(`${wechatOpenApiBaseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errcode) {
    const error = new Error(payload.errmsg || '微信开放平台接口请求失败');
    error.status = 502;
    error.wechatCode = payload.errcode || 0;
    throw error;
  }
  return payload;
}

async function getWechatOpenComponentAccessToken() {
  if (cachedWechatOpenComponentAccessToken && cachedWechatOpenComponentAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedWechatOpenComponentAccessToken.value;
  }
  if (!wechatOpenPlatformConfigured()) {
    const error = new Error('请先在微信开放平台创建并配置第三方平台');
    error.status = 409;
    throw error;
  }
  const db = await readDb();
  const ticket = String(db.wechatOpenPlatform?.componentVerifyTicket || '').trim();
  if (!ticket) {
    const error = new Error('尚未收到微信开放平台验证票据，请检查授权事件接收地址');
    error.status = 409;
    throw error;
  }
  const payload = await requestWechatOpenApi('/cgi-bin/component/api_component_token', {
    component_appid: wechatOpenComponentAppId,
    component_appsecret: wechatOpenComponentAppSecret,
    component_verify_ticket: ticket
  });
  if (!payload.component_access_token) throw new Error('微信开放平台未返回第三方平台令牌');
  cachedWechatOpenComponentAccessToken = {
    value: payload.component_access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 7200) - 60) * 1000
  };
  return cachedWechatOpenComponentAccessToken.value;
}

async function createWechatOpenPreAuthCode() {
  const componentAccessToken = await getWechatOpenComponentAccessToken();
  const payload = await requestWechatOpenApi(
    `/cgi-bin/component/api_create_preauthcode?component_access_token=${encodeURIComponent(componentAccessToken)}`,
    { component_appid: wechatOpenComponentAppId }
  );
  if (!payload.pre_auth_code) throw new Error('微信开放平台未返回预授权码');
  return payload.pre_auth_code;
}

function buildWechatOpenAuthorizationUrl(preAuthCode, state) {
  const callback = new URL(wechatOpenAuthRedirectUrl);
  callback.searchParams.set('state', state);
  const url = new URL(wechatOpenAuthPageUrl);
  url.searchParams.set('component_appid', wechatOpenComponentAppId);
  url.searchParams.set('pre_auth_code', preAuthCode);
  url.searchParams.set('redirect_uri', callback.toString());
  url.searchParams.set('auth_type', '1');
  return url.toString();
}

function publicOfficialAccountAuthorization(item) {
  return {
    key: item.appid,
    appid: item.appid,
    name: item.name,
    username: item.username || '',
    avatar: item.avatar || '',
    principalName: item.principalName || '',
    status: item.status,
    authorizedAt: item.authorizedAt
  };
}

async function exchangeWechatOpenAuthorizationCode(authorizationCode, memberOpenid) {
  const componentAccessToken = await getWechatOpenComponentAccessToken();
  const authorization = await requestWechatOpenApi(
    `/cgi-bin/component/api_query_auth?component_access_token=${encodeURIComponent(componentAccessToken)}`,
    {
      component_appid: wechatOpenComponentAppId,
      authorization_code: authorizationCode
    }
  );
  const authorizationInfo = authorization.authorization_info || {};
  const authorizerAppId = String(authorizationInfo.authorizer_appid || '').trim();
  if (!authorizerAppId || !authorizationInfo.authorizer_refresh_token) {
    throw new Error('微信公众号授权信息不完整');
  }
  const details = await requestWechatOpenApi(
    `/cgi-bin/component/api_get_authorizer_info?component_access_token=${encodeURIComponent(componentAccessToken)}`,
    {
      component_appid: wechatOpenComponentAppId,
      authorizer_appid: authorizerAppId
    }
  );
  const info = details.authorizer_info || {};
  const now = nowIso();
  return withDbWrite(async db => {
    let record = db.officialAccountAuthorizations.find(item => item.appid === authorizerAppId);
    if (!record) {
      record = { id: createId('official_auth'), appid: authorizerAppId, createdAt: now };
      db.officialAccountAuthorizations.unshift(record);
    }
    record.memberOpenid = memberOpenid;
    record.name = String(info.nick_name || info.principal_name || authorizerAppId).trim();
    record.username = String(info.user_name || info.alias || '').trim();
    record.avatar = String(info.head_img || '').trim();
    record.qrcodeUrl = String(info.qrcode_url || '').trim();
    record.principalName = String(info.principal_name || '').trim();
    record.serviceType = Number(info.service_type_info?.id ?? -1);
    record.verifyType = Number(info.verify_type_info?.id ?? -1);
    record.permissions = (authorizationInfo.func_info || [])
      .map(item => Number(item?.funcscope_category?.id))
      .filter(Number.isFinite);
    record.authorizerAccessToken = String(authorizationInfo.authorizer_access_token || '');
    record.authorizerRefreshToken = String(authorizationInfo.authorizer_refresh_token || '');
    record.tokenExpiresAt = Date.now() + Math.max(60, Number(authorizationInfo.expires_in || 7200) - 60) * 1000;
    record.status = 'active';
    record.authorizedAt = record.authorizedAt || now;
    record.updatedAt = now;
    return publicOfficialAccountAuthorization(record);
  });
}

async function getAuthorizedOfficialAccountAccessToken(appid) {
  const db = await readDb();
  const record = db.officialAccountAuthorizations.find(item => item.appid === appid && item.status === 'active');
  if (!record) throw new Error('授权公众号不存在或授权已取消');
  if (record.authorizerAccessToken && Number(record.tokenExpiresAt) > Date.now() + 60_000) {
    return record.authorizerAccessToken;
  }
  const componentAccessToken = await getWechatOpenComponentAccessToken();
  const payload = await requestWechatOpenApi(
    `/cgi-bin/component/api_authorizer_token?component_access_token=${encodeURIComponent(componentAccessToken)}`,
    {
      component_appid: wechatOpenComponentAppId,
      authorizer_appid: appid,
      authorizer_refresh_token: record.authorizerRefreshToken
    }
  );
  const token = String(payload.authorizer_access_token || '');
  if (!token) throw new Error('微信开放平台未返回公众号令牌');
  await withDbWrite(async current => {
    const target = current.officialAccountAuthorizations.find(item => item.appid === appid);
    if (!target) return;
    target.authorizerAccessToken = token;
    target.authorizerRefreshToken = String(payload.authorizer_refresh_token || target.authorizerRefreshToken || '');
    target.tokenExpiresAt = Date.now() + Math.max(60, Number(payload.expires_in || 7200) - 60) * 1000;
    target.updatedAt = nowIso();
  });
  return token;
}

async function getAuthorizedOfficialFollowerProfile(appid, openid) {
  const url = new URL(wechatOpenUserInfoUrl);
  url.searchParams.set('access_token', await getAuthorizedOfficialAccountAccessToken(appid));
  url.searchParams.set('openid', openid);
  url.searchParams.set('lang', 'zh_CN');
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errcode) throw new Error(payload.errmsg || '读取公众号关注状态失败');
  return payload;
}

async function recordWechatOpenPlatformEvent(message) {
  const infoType = String(message.InfoType || '').toLowerCase();
  if (infoType === 'component_verify_ticket' && message.ComponentVerifyTicket) {
    cachedWechatOpenComponentAccessToken = null;
    await withDbWrite(async db => {
      db.wechatOpenPlatform = {
        ...(db.wechatOpenPlatform || {}),
        componentVerifyTicket: String(message.ComponentVerifyTicket),
        ticketUpdatedAt: nowIso()
      };
    });
    return;
  }
  if (infoType === 'unauthorized' && message.AuthorizerAppid) {
    await withDbWrite(async db => {
      const record = db.officialAccountAuthorizations.find(item => item.appid === String(message.AuthorizerAppid));
      if (!record) return;
      record.status = 'revoked';
      record.updatedAt = nowIso();
    });
  }
}

function bindConfiguredParticipationConditions(source, proofToken, member, db) {
  const conditions = normalizeParticipationConditions(source);
  const capabilities = integrationCapabilities();
  if (conditions.fansOnly) {
    const requestedAppId = String(conditions.officialAccountAppId || '').trim();
    const authorization = db.officialAccountAuthorizations.find(item =>
      item.memberOpenid === member.openid &&
      item.status === 'active' &&
      item.appid === requestedAppId
    );
    if (authorization) {
      conditions.officialAccountAppId = authorization.appid;
      conditions.officialAccountName = authorization.name;
      conditions.officialAccountUsername = authorization.username || '';
    } else if (capabilities.officialAccount.configured && (!requestedAppId || requestedAppId === officialAccountAppId)) {
      conditions.officialAccountAppId = officialAccountAppId;
      conditions.officialAccountName = officialAccountName;
      conditions.officialAccountUsername = officialAccountUsername;
    } else {
      const error = new Error('公众号关注校验尚未在服务器完成配置');
      error.status = 409;
      throw error;
    }
  }
  if (conditions.wecom) {
    if (!capabilities.wecom.configured) {
      const error = new Error('企业微信联系人校验尚未在服务器完成配置');
      error.status = 409;
      throw error;
    }
    conditions.wecomCorpId = wecomCorpId;
    conditions.wecomName = wecomName;
  }
  if (conditions.region && !conditions.regionConfig) {
    const error = new Error('请设置允许参与的中心位置和范围');
    error.status = 400;
    throw error;
  }
  if (conditions.survey && !conditions.surveyQuestions.length) {
    const error = new Error('请至少设置一个问卷问题');
    error.status = 400;
    throw error;
  }
  if (conditions.task && !conditions.taskText) {
    const error = new Error('请填写参与前需要完成的任务');
    error.status = 400;
    throw error;
  }
  if (conditions.answer) {
    if (!conditions.answerQuestion || !conditions.answerValue) {
      const error = new Error('请完整填写参与问题和正确答案');
      error.status = 400;
      throw error;
    }
    conditions.answerHash = digestConditionValue(conditions.answerValue, true);
    conditions.answerValue = '';
  }
  if (conditions.vote && (!conditions.voteQuestion || conditions.voteOptions.length < 2)) {
    const error = new Error('投票参与至少需要设置两个选项');
    error.status = 400;
    throw error;
  }
  return bindGroupRestriction(conditions, proofToken, member, db);
}

function distanceMeters(pointA, pointB) {
  const toRadians = value => value * Math.PI / 180;
  const latitudeA = toRadians(pointA.latitude);
  const latitudeB = toRadians(pointB.latitude);
  const latitudeDelta = latitudeB - latitudeA;
  const longitudeDelta = toRadians(pointB.longitude - pointA.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  const clamped = Math.max(0, Math.min(1, value));
  return 6371000 * 2 * Math.atan2(Math.sqrt(clamped), Math.sqrt(1 - clamped));
}

function normalizeSurveyAnswers(questions, source) {
  const input = Array.isArray(source) ? source : [];
  return questions.map(question => {
    const answer = input.find(item => String(item?.questionId || '') === question.id);
    const value = String(answer?.value || '').trim().slice(0, 500);
    if (question.required && !value) {
      const error = new Error(`请填写问卷：${question.title}`);
      error.status = 400;
      throw error;
    }
    return { questionId: question.id, question: question.title, value };
  });
}

function shanghaiDateKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value));
}

function completedActivityTime(activity) {
  return Date.parse(activity.updatedAt || activity.drawAt || activity.endAt || activity.createdAt || '') || 0;
}

function recentEndedActivitiesForCreator(db, creatorOpenid, days = 30) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return db.activities
    .filter(activity =>
      activity.creatorOpenid === creatorOpenid &&
      ['drawn', 'ended'].includes(activity.status) &&
      completedActivityTime(activity) >= cutoff
    )
    .sort((left, right) => completedActivityTime(right) - completedActivityTime(left));
}

function recentWinnerForMember(db, memberOpenid, activityIds) {
  const selectedActivityIds = new Set(normalizeActivityIdList(activityIds));
  if (!selectedActivityIds.size) return false;
  const participantIds = new Set(db.participants
    .filter(item => item.memberOpenid === memberOpenid && selectedActivityIds.has(item.activityId))
    .map(item => item.id));
  return db.winners.some(item => selectedActivityIds.has(item.activityId) && participantIds.has(item.participantId));
}

function verifyParticipationEligibility(db, activity, member, body = {}) {
  const blocked = db.creatorBlacklists.some(item =>
    item.creatorOpenid === activity.creatorOpenid &&
    item.memberOpenid === member.openid &&
    item.status !== 'removed'
  );
  if (blocked) {
    const error = new Error('你已被该发起人限制参与抽奖');
    error.status = 403;
    throw error;
  }
  const conditions = normalizeParticipationConditions(activity.conditions);
  const advanced = normalizeAdvanced(activity.advanced);
  const specialConfig = normalizeSpecialConfig(activity.specialConfig);
  const candidateUnionIds = specialConfig.annual?.candidateUnionIds || [];
  const candidateNames = specialConfig.annual?.candidateNames || [];
  if (candidateUnionIds.length && !candidateUnionIds.includes(String(member.unionid || '').trim())) {
    const error = new Error('当前微信账号不在本次年会抽奖指定名单中');
    error.status = 403;
    throw error;
  }
  if (!candidateUnionIds.length && candidateNames.length && !candidateNames.includes(String(member.nickname || '').trim())) {
    const error = new Error('当前微信昵称不在本次年会抽奖指定名单中');
    error.status = 403;
    throw error;
  }
  if (conditions.groupOnly) {
    if (conditions.groupType === 'wecom') {
      if (!member.unionid) {
        const error = new Error('当前微信账号暂未取得统一身份，无法校验企业微信客户群');
        error.status = 403;
        throw error;
      }
      const group = db.wecomGroups.find(item =>
        item.corpId === conditions.wecomCorpId && item.id === activity.conditions.allowedWecomGroupId
      );
      if (!group || !group.memberUnionids.includes(member.unionid)) {
        const error = new Error('当前微信账号不在活动指定企业微信客户群');
        error.status = 403;
        throw error;
      }
    } else {
      const proof = verifyGroupProof(body.groupProof, member.openid);
      if (proof.openGId !== activity.conditions.allowedGroupOpenGid) {
        const error = new Error('当前微信群不是活动指定群聊');
        error.status = 403;
        throw error;
      }
    }
  }

  if (conditions.fansOnly) {
    if (!member.unionid) {
      const error = new Error('当前微信账号暂未取得统一身份，请确认公众号与小程序已绑定同一开放平台后重新登录');
      error.status = 403;
      throw error;
    }
    const followed = db.officialFollowers.some(item =>
      item.appid === conditions.officialAccountAppId &&
      item.unionid === member.unionid &&
      item.subscribed === true
    );
    if (!followed) {
      const error = new Error(`请先关注${conditions.officialAccountName || '指定公众号'}后再参与`);
      error.status = 403;
      throw error;
    }
  }

  if (conditions.wecom) {
    if (!member.unionid) {
      const error = new Error('当前微信账号暂未取得统一身份，无法校验企业微信联系人');
      error.status = 403;
      throw error;
    }
    const contact = db.wecomContacts.some(item =>
      item.corpId === conditions.wecomCorpId &&
      item.unionid === member.unionid &&
      item.active === true
    );
    if (!contact) {
      const error = new Error(`请先添加${conditions.wecomName || '指定企业微信'}后再参与`);
      error.status = 403;
      throw error;
    }
  }

  if (conditions.task) {
    const taskRecord = db.activityTasks.find(item =>
      item.activityId === activity.id &&
      item.memberOpenid === member.openid &&
      item.status === 'completed'
    );
    if (!taskRecord) {
      const error = new Error(`请先完成指定任务：${conditions.taskText || '参与前任务'}`);
      error.status = 403;
      throw error;
    }
  }

  if (conditions.answer && digestConditionValue(body.answerText, true) !== conditions.answerHash) {
    const error = new Error('参与问题回答不正确');
    error.status = 403;
    throw error;
  }

  let voteAnswer = '';
  if (conditions.vote) {
    voteAnswer = String(body.voteAnswer || '').trim();
    if (!conditions.voteOptions.includes(voteAnswer)) {
      const error = new Error('请选择有效的投票选项');
      error.status = 400;
      throw error;
    }
  }

  if (advanced.enabled && advanced.recentWinnerBlock &&
    recentWinnerForMember(db, member.openid, advanced.recentWinnerActivityIds)) {
    const error = new Error('你曾在本活动设置的近期抽奖中中奖，本次暂不可参与');
    error.status = 403;
    throw error;
  }

  let location = null;
  if (conditions.region) {
    location = normalizeRegionConfig({
      latitude: body.location?.latitude,
      longitude: body.location?.longitude,
      radiusMeters: 100,
      name: '参与位置'
    });
    if (!location) {
      const error = new Error('请授权获取当前位置后再参与');
      error.status = 400;
      throw error;
    }
    const distance = distanceMeters(conditions.regionConfig, location);
    if (distance > conditions.regionConfig.radiusMeters) {
      const error = new Error(`当前位置不在${conditions.regionConfig.name}允许范围内`);
      error.status = 403;
      throw error;
    }
    location = { latitude: location.latitude, longitude: location.longitude, distanceMeters: Math.round(distance) };
  }

  const surveyAnswers = conditions.survey
    ? normalizeSurveyAnswers(conditions.surveyQuestions, body.surveyAnswers)
    : [];
  return {
    location,
    surveyAnswers,
    taskCompleted: conditions.task ? true : false,
    answerText: conditions.answer ? String(body.answerText || '').trim().slice(0, 120) : '',
    voteAnswer
  };
}

function subscriptionTemplate(type) {
  if (type === 'draw_reminder') {
    return { id: wechatDrawReminderTemplateId, data: wechatDrawReminderTemplateData };
  }
  if (type === 'cash') {
    return {
      id: wechatCashTemplateId,
      data: wechatCashTemplateData
    };
  }
  if (type === 'comment') {
    return { id: wechatCommentTemplateId, data: wechatCommentTemplateData };
  }
  return { id: wechatDrawResultTemplateId, data: wechatDrawResultTemplateData };
}

function parseTemplateData(source) {
  if (!source) return null;
  try {
    const parsed = JSON.parse(source);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function subscriptionTemplateCapability(type) {
  const template = subscriptionTemplate(type);
  return {
    configured: Boolean(template.id && parseTemplateData(template.data)),
    templateId: template.id || ''
  };
}

function formatWechatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function renderTemplateValue(value, context) {
  return String(value || '').replace(
    /\{\{(activityTitle|prizeName|drawAt|result|reminderText|cashReceivedAt|cashDescription|cashAmount|commenterName|commentContent|commentAt)\}\}/g,
    (match, key) => context[key] || ''
  );
}

function normalizeTemplateValue(key, value) {
  if (/^thing\d+$/.test(key)) return Array.from(String(value || '')).slice(0, 20).join('');
  return String(value || '');
}

function buildSubscribeMessageData(source, context) {
  const template = parseTemplateData(source);
  if (!template) return null;
  return Object.fromEntries(Object.entries(template).map(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return [key, {
        ...value,
        value: normalizeTemplateValue(key, renderTemplateValue(value.value, context))
      }];
    }
    return [key, { value: normalizeTemplateValue(key, renderTemplateValue(value, context)) }];
  }));
}

async function getWechatAccessToken() {
  if (cachedWechatAccessToken && cachedWechatAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedWechatAccessToken.value;
  }
  if (!wechatAppId || !wechatAppSecret) {
    throw new Error('微信服务配置不完整');
  }
  const response = await fetch(wechatAccessTokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credential',
      appid: wechatAppId,
      secret: wechatAppSecret,
      force_refresh: false
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errcode || !payload.access_token) {
    throw new Error(payload.errmsg || '获取微信服务访问凭证失败');
  }
  cachedWechatAccessToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 7200) - 60) * 1000
  };
  return cachedWechatAccessToken.value;
}

async function getOfficialAccountAccessToken() {
  if (cachedOfficialAccountAccessToken && cachedOfficialAccountAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedOfficialAccountAccessToken.value;
  }
  if (!integrationCapabilities().officialAccount.configured) {
    throw new Error('公众号服务配置不完整');
  }
  const response = await fetch(officialAccountAccessTokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credential',
      appid: officialAccountAppId,
      secret: officialAccountAppSecret,
      force_refresh: false
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errcode || !payload.access_token) {
    throw new Error(payload.errmsg || '获取公众号访问凭证失败');
  }
  cachedOfficialAccountAccessToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 7200) - 60) * 1000
  };
  return cachedOfficialAccountAccessToken.value;
}

async function getOfficialFollowerProfile(openid) {
  const url = new URL(officialAccountUserInfoUrl);
  url.searchParams.set('access_token', await getOfficialAccountAccessToken());
  url.searchParams.set('openid', openid);
  url.searchParams.set('lang', 'zh_CN');
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errcode) {
    throw new Error(payload.errmsg || '读取公众号关注状态失败');
  }
  return payload;
}

function verifyWechatCallbackSignature(query = {}) {
  if (!officialAccountToken) return false;
  const expected = crypto.createHash('sha1')
    .update([officialAccountToken, String(query.timestamp || ''), String(query.nonce || '')].sort().join(''))
    .digest('hex');
  const actual = String(query.signature || '');
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

async function recordOfficialAccountEvent(message, options = {}) {
  const event = String(message.Event || '').toLowerCase();
  const openid = String(message.FromUserName || '').trim();
  if (!openid || !['subscribe', 'unsubscribe'].includes(event)) return;
  const appid = String(options.appid || officialAccountAppId).trim();
  if (!appid) return;
  let profile = null;
  if (event === 'subscribe') {
    profile = options.authorized
      ? await getAuthorizedOfficialFollowerProfile(appid, openid)
      : await getOfficialFollowerProfile(openid);
  }
  await withDbWrite(async db => {
    let follower = db.officialFollowers.find(item => item.appid === appid && item.openid === openid);
    if (!follower) {
      follower = {
        id: createId('official_follower'),
        appid,
        openid,
        unionid: String(profile?.unionid || ''),
        subscribed: event === 'subscribe',
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      db.officialFollowers.unshift(follower);
    } else {
      follower.unionid = String(profile?.unionid || follower.unionid || '');
      follower.subscribed = event === 'subscribe';
      follower.updatedAt = nowIso();
    }
  });
}

async function getWecomAccessToken() {
  if (cachedWecomAccessToken && cachedWecomAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedWecomAccessToken.value;
  }
  if (!integrationCapabilities().wecom.configured) throw new Error('企业微信服务配置不完整');
  const url = new URL(`${wecomApiBaseUrl}/cgi-bin/gettoken`);
  url.searchParams.set('corpid', wecomCorpId);
  url.searchParams.set('corpsecret', wecomContactSecret);
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errcode || !payload.access_token) {
    throw new Error(payload.errmsg || '获取企业微信访问凭证失败');
  }
  cachedWecomAccessToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 7200) - 60) * 1000
  };
  return cachedWecomAccessToken.value;
}

async function fetchWecomApi(pathname, search = {}) {
  const url = new URL(`${wecomApiBaseUrl}${pathname}`);
  url.searchParams.set('access_token', await getWecomAccessToken());
  for (const [key, value] of Object.entries(search)) url.searchParams.set(key, value);
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errcode) throw new Error(payload.errmsg || '企业微信接口请求失败');
  return payload;
}

async function postWecomApi(pathname, body = {}) {
  const url = new URL(`${wecomApiBaseUrl}${pathname}`);
  url.searchParams.set('access_token', await getWecomAccessToken());
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errcode) throw new Error(payload.errmsg || '企业微信接口请求失败');
  return payload;
}

async function syncWecomContacts() {
  const followUsers = await fetchWecomApi('/cgi-bin/externalcontact/get_follow_user_list');
  const externalIds = new Set();
  for (const userid of followUsers.follow_user || []) {
    const list = await fetchWecomApi('/cgi-bin/externalcontact/list', { userid });
    for (const externalUserId of list.external_userid || []) externalIds.add(externalUserId);
  }
  const contacts = [];
  for (const externalUserId of externalIds) {
    const detail = await fetchWecomApi('/cgi-bin/externalcontact/get', { external_userid: externalUserId });
    const external = detail.external_contact || {};
    if (!external.unionid) continue;
    contacts.push({
      id: `wecom_${crypto.createHash('sha256').update(`${wecomCorpId}:${externalUserId}`).digest('hex').slice(0, 32)}`,
      corpId: wecomCorpId,
      externalUserId,
      unionid: String(external.unionid),
      name: String(external.name || ''),
      active: true,
      updatedAt: nowIso()
    });
  }
  const contactUnionids = new Map(contacts.map(item => [item.externalUserId, item.unionid]));
  const groupIds = [];
  let cursor = '';
  do {
    const list = await postWecomApi('/cgi-bin/externalcontact/groupchat/list', {
      status_filter: 0,
      cursor,
      limit: 1000
    });
    for (const item of list.group_chat_list || []) {
      if (item.chat_id) groupIds.push(item.chat_id);
    }
    cursor = String(list.next_cursor || '');
  } while (cursor);
  const groups = [];
  for (const chatId of groupIds) {
    const detail = await postWecomApi('/cgi-bin/externalcontact/groupchat/get', {
      chat_id: chatId,
      need_name: 1
    });
    const group = detail.group_chat || {};
    const memberUnionids = (group.member_list || [])
      .map(item => contactUnionids.get(String(item.userid || '')))
      .filter(Boolean);
    groups.push({
      id: `wecom_group_${crypto.createHash('sha256').update(`${wecomCorpId}:${chatId}`).digest('hex').slice(0, 24)}`,
      corpId: wecomCorpId,
      chatId: String(chatId),
      name: String(group.name || '企业微信客户群').trim(),
      memberUnionids: [...new Set(memberUnionids)],
      memberCount: Number((group.member_list || []).length),
      updatedAt: nowIso()
    });
  }
  await withDbWrite(async db => {
    db.wecomContacts = [
      ...db.wecomContacts.filter(item => item.corpId !== wecomCorpId),
      ...contacts
    ];
    db.wecomGroups = [
      ...db.wecomGroups.filter(item => item.corpId !== wecomCorpId),
      ...groups
    ];
  });
  return { contacts, groups };
}

async function sendWechatSubscribeMessage(subscription, activity, result, prizeName, extraContext = {}) {
  const template = subscriptionTemplate(subscription.type);
  const data = buildSubscribeMessageData(template.data, {
    activityTitle: activity.title,
    prizeName,
    drawAt: formatWechatDateTime(activity.drawAt),
    result,
    reminderText: extraContext.reminderText || '',
    cashReceivedAt: extraContext.cashReceivedAt || '',
    cashDescription: extraContext.cashDescription || '',
    cashAmount: extraContext.cashAmount || '',
    commenterName: subscription.commenterName || '',
    commentContent: subscription.commentContent || '',
    commentAt: formatWechatDateTime(subscription.commentAt)
  });
  if (!template.id || !data) {
    return { sent: false, status: 'not_configured' };
  }
  const accessToken = await getWechatAccessToken();
  const url = new URL(wechatSubscribeSendUrl);
  url.searchParams.set('access_token', accessToken);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      touser: subscription.openid,
      template_id: template.id,
      page: subscription.page || wechatNotifyPage,
      miniprogram_state: wechatMiniProgramState,
      lang: 'zh_CN',
      data
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errcode) {
    throw new Error(payload.errmsg || '发送微信订阅消息失败');
  }
  return { sent: true, status: 'sent', messageId: payload.msgid || '' };
}

function nextNotificationRetryAt(attemptCount) {
  if (attemptCount >= notificationMaxAttempts) return null;
  const delays = notificationRetryDelaysMs.length ? notificationRetryDelaysMs : [60_000];
  const delay = delays[Math.min(Math.max(0, attemptCount - 1), delays.length - 1)];
  return new Date(Date.now() + delay).toISOString();
}

function notificationAttemptDue(subscription, timestamp = Date.now()) {
  if (Number(subscription.attemptCount || 0) >= notificationMaxAttempts) return false;
  const nextAttemptAt = Date.parse(subscription.nextAttemptAt || '');
  return !Number.isFinite(nextAttemptAt) || nextAttemptAt <= timestamp;
}

async function dispatchActivityDrawNotifications(activityId) {
  return withDbWrite(async db => {
    const activity = db.activities.find(item => item.id === activityId);
    if (!activity) return [];
    const participantByOpenid = new Map(
      db.participants
        .filter(item => item.activityId === activity.id && item.memberOpenid)
        .map(item => [item.memberOpenid, item])
    );
    const subscriptions = db.subscriptions.filter(item =>
      item.activityId === activity.id &&
      ['draw', 'draw_result', 'cash'].includes(item.type) &&
      item.status === 'accepted' &&
      !item.sentAt &&
      notificationAttemptDue(item)
    );
    const logs = [];
    for (const subscription of subscriptions) {
      const participant = participantByOpenid.get(subscription.openid);
      const winner = participant && db.winners.find(item => item.activityId === activity.id && item.participantId === participant.id);
      const prize = winner && db.prizes.find(item => item.id === winner.prizeId);
      const defaultPrize = db.prizes.find(item => item.activityId === activity.id);
      const prizeName = prize?.name || defaultPrize?.name || '活动奖品';
      const result = winner ? '恭喜中奖' : '未中奖';
      const attemptedAt = nowIso();
      const attemptCount = Math.max(0, Number(subscription.attemptCount || 0)) + 1;
      if (subscription.type === 'cash' && (!winner || prize?.type !== '红包')) {
        const log = {
          id: createId('notice'),
          subscriptionId: subscription.id,
          activityId: activity.id,
          openid: subscription.openid,
          type: 'cash',
          status: 'not_applicable',
          attemptCount: 0,
          createdAt: attemptedAt
        };
        db.notificationLogs.unshift(log);
        subscription.status = 'not_applicable';
        subscription.lastDeliveryStatus = 'not_applicable';
        subscription.lastError = '';
        subscription.nextAttemptAt = null;
        logs.push(log);
        continue;
      }
      subscription.attemptCount = attemptCount;
      subscription.lastAttemptAt = attemptedAt;
      try {
        const delivery = await sendWechatSubscribeMessage(subscription, activity, result, prizeName,
          subscription.type === 'cash'
            ? {
                cashReceivedAt: formatWechatDateTime(attemptedAt),
                cashDescription: prizeName,
                cashAmount: Math.max(0, Number(prize.faceValue || 0)).toFixed(2)
              }
            : {}
        );
        const log = {
          id: createId('notice'),
          subscriptionId: subscription.id,
          activityId: activity.id,
          openid: subscription.openid,
          status: delivery.status,
          messageId: delivery.messageId || '',
          attemptCount,
          createdAt: attemptedAt
        };
        db.notificationLogs.unshift(log);
        subscription.lastDeliveryStatus = delivery.status;
        subscription.lastError = '';
        if (delivery.sent) {
          subscription.sentAt = log.createdAt;
          subscription.nextAttemptAt = null;
        } else {
          subscription.nextAttemptAt = nextNotificationRetryAt(attemptCount);
        }
        logs.push(log);
      } catch (error) {
        const log = {
          id: createId('notice'),
          subscriptionId: subscription.id,
          activityId: activity.id,
          openid: subscription.openid,
          status: 'failed',
          error: error.message,
          attemptCount,
          createdAt: attemptedAt
        };
        db.notificationLogs.unshift(log);
        subscription.lastDeliveryStatus = 'failed';
        subscription.lastError = String(error.message || '').slice(0, 240);
        subscription.nextAttemptAt = nextNotificationRetryAt(attemptCount);
        logs.push(log);
      }
    }
    db.notificationLogs = db.notificationLogs.slice(0, 1000);
    return logs;
  });
}

function reminderNotificationDue(activity, timestamp = Date.now()) {
  const drawAt = Date.parse(activity.drawAt || '');
  return Number.isFinite(drawAt) && drawAt > timestamp && drawAt - timestamp <= drawReminderLeadMs;
}

async function dispatchActivityDrawReminders(activityId) {
  return withDbWrite(async db => {
    const activity = db.activities.find(item => item.id === activityId);
    if (!activity || activity.status !== 'live' || !reminderNotificationDue(activity)) return [];
    const subscriptions = db.subscriptions.filter(item =>
      item.activityId === activity.id &&
      item.type === 'draw_reminder' &&
      item.status === 'accepted' &&
      !item.sentAt &&
      notificationAttemptDue(item)
    );
    const defaultPrize = db.prizes.find(item => item.activityId === activity.id);
    const prizeName = defaultPrize?.name || '活动奖品';
    const logs = [];
    for (const subscription of subscriptions) {
      const attemptedAt = nowIso();
      const attemptCount = Math.max(0, Number(subscription.attemptCount || 0)) + 1;
      subscription.attemptCount = attemptCount;
      subscription.lastAttemptAt = attemptedAt;
      try {
        const delivery = await sendWechatSubscribeMessage(
          subscription,
          activity,
          '开奖提醒',
          prizeName,
          { reminderText: `开奖时间：${formatWechatDateTime(activity.drawAt)}` }
        );
        const log = {
          id: createId('notice'),
          subscriptionId: subscription.id,
          activityId: activity.id,
          openid: subscription.openid,
          type: 'draw_reminder',
          status: delivery.status,
          messageId: delivery.messageId || '',
          attemptCount,
          createdAt: attemptedAt
        };
        db.notificationLogs.unshift(log);
        subscription.lastDeliveryStatus = delivery.status;
        subscription.lastError = '';
        if (delivery.sent) {
          subscription.sentAt = log.createdAt;
          subscription.nextAttemptAt = null;
        } else {
          subscription.nextAttemptAt = nextNotificationRetryAt(attemptCount);
        }
        logs.push(log);
      } catch (error) {
        const log = {
          id: createId('notice'),
          subscriptionId: subscription.id,
          activityId: activity.id,
          openid: subscription.openid,
          type: 'draw_reminder',
          status: 'failed',
          error: error.message,
          attemptCount,
          createdAt: attemptedAt
        };
        db.notificationLogs.unshift(log);
        subscription.lastDeliveryStatus = 'failed';
        subscription.lastError = String(error.message || '').slice(0, 240);
        subscription.nextAttemptAt = nextNotificationRetryAt(attemptCount);
        logs.push(log);
      }
    }
    db.notificationLogs = db.notificationLogs.slice(0, 1000);
    return logs;
  });
}

async function processPendingDrawReminders() {
  const db = await readDb();
  const activityIds = [...new Set(db.subscriptions
    .filter(item => item.type === 'draw_reminder' && item.status === 'accepted' && !item.sentAt && notificationAttemptDue(item))
    .map(item => item.activityId))]
    .filter(activityId => {
      const activity = db.activities.find(item => item.id === activityId);
      return activity && activity.status === 'live' && reminderNotificationDue(activity);
    });
  const logs = [];
  for (const activityId of activityIds) {
    logs.push(...await dispatchActivityDrawReminders(activityId));
  }
  return logs;
}

async function processPendingDrawNotifications() {
  const db = await readDb();
  const completedActivityIds = new Set(db.activities
    .filter(item => ['drawn', 'ended'].includes(item.status))
    .map(item => item.id));
  const activityIds = [...new Set(db.subscriptions
    .filter(item =>
      completedActivityIds.has(item.activityId) &&
      ['draw', 'draw_result', 'cash'].includes(item.type) &&
      item.status === 'accepted' &&
      !item.sentAt &&
      notificationAttemptDue(item)
    )
    .map(item => item.activityId))];
  const logs = [];
  for (const activityId of activityIds) {
    logs.push(...await dispatchActivityDrawNotifications(activityId));
  }
  return logs;
}

async function dispatchActivityCommentNotification(commentId) {
  return withDbWrite(async db => {
    const comment = db.comments.find(item => item.id === commentId);
    const activity = comment && db.activities.find(item => item.id === comment.activityId);
    if (!comment || !activity) return [];
    const subscriptions = db.subscriptions.filter(item =>
      item.activityId === activity.id &&
      item.type === 'comment' &&
      item.status === 'accepted' &&
      !item.sentAt
    );
    const logs = [];
    for (const subscription of subscriptions) {
      try {
        const delivery = await sendWechatSubscribeMessage({
          ...subscription,
          page: `pages/detail/detail?id=${encodeURIComponent(activity.id)}`,
          commenterName: comment.nickname || '微信用户',
          commentContent: comment.content,
          commentAt: comment.createdAt
        }, activity, '收到新留言', '');
        const log = {
          id: createId('notice'),
          subscriptionId: subscription.id,
          activityId: activity.id,
          openid: subscription.openid,
          status: delivery.status,
          messageId: delivery.messageId || '',
          createdAt: nowIso()
        };
        db.notificationLogs.unshift(log);
        if (delivery.sent) subscription.sentAt = log.createdAt;
        logs.push(log);
      } catch (error) {
        const log = {
          id: createId('notice'),
          subscriptionId: subscription.id,
          activityId: activity.id,
          openid: subscription.openid,
          status: 'failed',
          error: error.message,
          createdAt: nowIso()
        };
        db.notificationLogs.unshift(log);
        logs.push(log);
      }
    }
    db.notificationLogs = db.notificationLogs.slice(0, 1000);
    return logs;
  });
}

function upsertWechatSession(db, login, profileInput = {}) {
  normalizeDb(db);
  const now = nowIso();
  const profileCompleted = profileInput.profileConfirmed === true;
  let member = db.members.find(item => item.openid === login.openid);
  if (!member) {
    member = {
      id: createId('member'),
      openid: login.openid,
      unionid: login.unionid || '',
      nickname: String(profileInput.nickname || '微信用户').trim() || '微信用户',
      avatar: String(profileInput.avatar || '/assets/avatar-default.svg').trim(),
      level: 2,
      profileCompleted,
      createdAt: now,
      updatedAt: now,
      lastLoginAt: now
    };
    db.members.unshift(member);
  } else {
    member.unionid = login.unionid || member.unionid || '';
    member.nickname = String(profileInput.nickname || member.nickname || '微信用户').trim();
    member.avatar = String(profileInput.avatar || member.avatar || '/assets/avatar-default.svg').trim();
    member.profileCompleted = member.profileCompleted === true || profileCompleted;
    member.updatedAt = now;
    member.lastLoginAt = now;
  }

  const sessionId = createId('session');
  const sessionKeyHash = login.session_key
    ? crypto.createHash('sha256').update(String(login.session_key)).digest('hex')
    : '';
  db.sessions = db.sessions.filter(item => {
    const expiresAt = Date.parse(item.expiresAt || '');
    return !Number.isFinite(expiresAt) || expiresAt > Date.now();
  });
  db.sessions.unshift({
    id: sessionId,
    openid: login.openid,
    unionid: login.unionid || '',
    sessionKeyHash,
    createdAt: now,
    expiresAt: new Date(Date.now() + sessionLifetimeMs).toISOString()
  });
  db.sessions = db.sessions.slice(0, maxStoredSessions);
  return { member, sessionId };
}

function normalizePublicCreateInput(body) {
  const rawPrizes = Array.isArray(body.prizes) && body.prizes.length
    ? body.prizes
    : [{
        name: body.prizeName || body.title,
        quantity: body.prizeQuantity || body.quantity,
        type: body.prizeType,
        image: body.image,
        deliveryMethod: body.deliveryMethod,
        faceValue: body.faceValue
      }];
  const prizes = rawPrizes.slice(0, 20).map((item, index) => {
    const quantity = Math.max(1, Math.min(9999, Math.floor(Number(item?.quantity || 1))));
    const type = String(item?.type || item?.level || '奖品').trim();
    const faceValue = Math.max(0, Math.min(100000, Math.round(Number(item?.faceValue || 0) * 100) / 100));
    return {
      name: String(item?.name || '').trim(),
      level: String(item?.level || type || `奖项 ${index + 1}`).trim(),
      type,
      faceValue,
      quantity,
      image: String(item?.image || '/assets/prize-redpack.svg').trim(),
      deliveryMethod: String(item?.deliveryMethod || '发起人发货').trim(),
      unlockParticipants: Math.max(0, Math.min(999999, Math.floor(Number(item?.unlockParticipants || 0)))),
      sort: index + 1
    };
  });
  const firstPrize = prizes[0] || {
    name: '',
    level: '奖品',
    type: '奖品',
    faceValue: 0,
    quantity: 1,
    image: '/assets/prize-redpack.svg',
    deliveryMethod: '发起人发货',
    sort: 1
  };
  const prizeName = firstPrize.name;
  const quantity = firstPrize.quantity;
  const drawMode = ['time', 'people', 'instant'].includes(body.drawMode) ? body.drawMode : 'time';
  const drawAt = body.drawAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const drawParticipantTarget = Math.max(0, Math.min(999999, Number(body.drawParticipantTarget || 0)));
  const templateType = String(body.templateType || '').trim();
  return {
    activity: normalizeActivityInput({
      title: prizeName,
      subtitle: templateType || '普通抽奖',
      coverText: `${prizeName} x ${quantity} 份`,
      description: String(body.description || '参与用户按活动规则抽取中奖名额。').trim(),
      organizer: String(body.organizer || '抽奖工具').trim(),
      image: String(firstPrize.image || '/assets/prize-redpack.svg').trim(),
      sponsorText: String(body.sponsorText || '中奖后请按页面提示完成兑奖。').trim(),
      leadInfo: String(body.leadInfo || '').trim(),
      introImages: body.introImages,
      status: body.status === 'draft' ? 'draft' : 'live',
      startAt: nowIso(),
      endAt: drawAt,
      drawAt,
      drawMode,
      drawParticipantTarget,
      unlockByPeople: Boolean(body.unlockByPeople),
      instantPerUserLimit: body.instantPerUserLimit,
      instantParticipantLimit: body.instantParticipantLimit,
      autoDraw: true,
      templateType,
      specialConfig: body.specialConfig,
      homePlacement: body.homePlacement,
      homePriority: body.homePriority,
      promotion: body.promotion,
      advanced: body.advanced,
      conditions: normalizeSupportedCreateConditions(body.conditions),
      rule: drawMode === 'instant' ? '即抽即中，系统随机抽取。' : '每人限参与一次，到点后自动开奖。',
      shareTitle: `我发起了 ${prizeName} 抽奖`
    }, prizeName),
    prizes
  };
}

function remainingPrizes(db, activityId) {
  return db.prizes
    .filter(item => item.activityId === activityId && Number(item.remaining || 0) > 0)
    .sort((a, b) => Number(a.sort || 0) - Number(b.sort || 0));
}

function availablePrizes(db, activity) {
  const participantCount = db.participants.filter(item => item.activityId === activity.id).length;
  return remainingPrizes(db, activity.id).filter(prize =>
    !activity.unlockByPeople ||
    Number(prize.unlockParticipants || 0) <= participantCount
  );
}

function buildInstantWinningSlots(maxAttempts, prizeCount, offset = 0) {
  const total = Math.max(0, Math.floor(Number(maxAttempts || 0)));
  const count = Math.min(total, Math.max(0, Math.floor(Number(prizeCount || 0))));
  const slots = Array.from({ length: total }, (_, index) => offset + index + 1);
  for (let index = 0; index < count; index += 1) {
    const selected = crypto.randomInt(index, total);
    [slots[index], slots[selected]] = [slots[selected], slots[index]];
  }
  return slots.slice(0, count).sort((left, right) => left - right);
}

function ensureInstantWinningSlots(db, activity) {
  if (Array.isArray(activity.instantWinningSlots)) return activity.instantWinningSlots;
  const currentAttempts = Math.max(0, Number(activity.instantAttemptCount || 0));
  const maxAttempts = Number(activity.instantParticipantLimit || 5) * Number(activity.instantPerUserLimit || 1);
  const remainingAttempts = Math.max(0, maxAttempts - currentAttempts);
  const remainingPrizeCount = remainingPrizes(db, activity.id)
    .reduce((sum, prize) => sum + Number(prize.remaining || 0), 0);
  activity.instantWinningSlots = buildInstantWinningSlots(remainingAttempts, remainingPrizeCount, currentAttempts);
  return activity.instantWinningSlots;
}

function fulfillWinnerPrize(db, activity, prize, participant, winner) {
  const memberOpenid = String(participant.memberOpenid || '');
  if (!memberOpenid) return null;
  const type = String(prize.type || prize.level || '奖品');
  const createdAt = nowIso();
  const common = {
    memberOpenid,
    activityId: activity.id,
    prizeId: prize.id,
    winnerId: winner.id,
    createdAt
  };

  if (type === '红包') {
    const amount = Math.round(Number(prize.faceValue || 0) * 100) / 100;
    if (amount <= 0) return null;
    const record = {
      id: createId('wallet'),
      ...common,
      title: `${activity.title} · ${prize.name}`,
      type: 'lottery_redpacket',
      amount,
      status: 'completed'
    };
    db.wallet.records.unshift(record);
    winner.fulfillmentType = 'wallet';
    winner.fulfillmentId = record.id;
    return record;
  }

  if (type === '优惠券' || type === '兑换码') {
    const code = type === '兑换码' ? crypto.randomBytes(6).toString('hex').toUpperCase() : '';
    const coupon = {
      id: createId('coupon'),
      ...common,
      title: prize.name,
      value: type === '优惠券' ? `¥${Number(prize.faceValue || 0).toFixed(2)}` : code,
      code,
      status: 'available',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    db.coupons.unshift(coupon);
    winner.fulfillmentType = 'coupon';
    winner.fulfillmentId = coupon.id;
    return coupon;
  }

  const order = {
    id: createId('order'),
    ...common,
    title: prize.name,
    amount: 0,
    status: prize.deliveryMethod === '中奖者到店领取' ? '待领取' : '待发货'
  };
  db.orders.unshift(order);
  winner.fulfillmentType = 'order';
  winner.fulfillmentId = order.id;
  return order;
}

function drawWinners(db, activity, options = {}) {
  const available = availablePrizes(db, activity);
  const specialConfig = normalizeSpecialConfig(activity.specialConfig);
  const prizes = specialConfig.annualReverseDraw
    ? [...available].reverse()
    : available;
  if (!prizes.length) return [];

  const wonParticipantIds = new Set(db.winners.filter(item => item.activityId === activity.id).map(item => item.participantId));
  const candidateIds = options.participantIds ? new Set(options.participantIds) : null;
  const pool = db.participants.filter(item =>
    item.activityId === activity.id &&
    !wonParticipantIds.has(item.id) &&
    (!candidateIds || candidateIds.has(item.id))
  );
  if (!pool.length) return [];

  const requestedPrizeId = String(options.prizeId || '');
  const targetPrizes = requestedPrizeId ? prizes.filter(prize => prize.id === requestedPrizeId) : prizes;
  const count = Number.isFinite(Number(options.count)) ? Math.max(1, Number(options.count)) : Number.POSITIVE_INFINITY;
  const created = [];

  const takeWeightedParticipant = () => {
    const weights = pool.map(item => participantDrawStats(db, activity, item).drawWeight);
    const totalWeight = weights.reduce((sum, value) => sum + value, 0);
    let cursor = crypto.randomInt(totalWeight);
    let selectedIndex = 0;
    for (let index = 0; index < weights.length; index += 1) {
      cursor -= weights[index];
      if (cursor < 0) {
        selectedIndex = index;
        break;
      }
    }
    return {
      participant: pool.splice(selectedIndex, 1)[0],
      selectionWeight: weights[selectedIndex]
    };
  };

  for (const prize of targetPrizes) {
    while (prize.remaining > 0 && pool.length > 0 && created.length < count) {
      const { participant, selectionWeight } = takeWeightedParticipant();
      const winner = {
        id: createId('win'),
        activityId: activity.id,
        prizeId: prize.id,
        participantId: participant.id,
        selectionWeight,
        revealMode: specialConfig.styleKey || (specialConfig.annual ? 'annual' : (activity.templateType || 'standard')),
        resultCode: crypto.randomBytes(5).toString('hex').toUpperCase(),
        claimed: false,
        claimedAt: null,
        createdAt: nowIso()
      };
      fulfillWinnerPrize(db, activity, prize, participant, winner);
      db.winners.unshift(winner);
      prize.remaining -= 1;
      created.push({ ...winner, prize, participant });
    }
    if (created.length >= count) break;
  }
  if (created.length) {
    appendActivityEvent(db, activity.id, 'draw_result', {
      drawMode: activity.drawMode,
      revealMode: created[0].revealMode,
      winners: created.map(item => ({
        winnerId: item.id,
        prizeId: item.prizeId,
        prizeName: item.prize?.name || '',
        nickname: maskedNickname(item.participant?.nickname),
        resultCode: item.resultCode
      }))
    });
  }

  if (db.prizes.filter(item => item.activityId === activity.id).every(item => Number(item.remaining || 0) <= 0)) {
    activity.status = 'drawn';
  }
  activity.updatedAt = nowIso();
  return created;
}

function dueTimeActivities(db) {
  const now = Date.now();
  return db.activities.filter(activity =>
    activity.status === 'live' &&
    activity.autoDraw === true &&
    ['time', 'people', 'instant'].includes(activity.drawMode) &&
    new Date(activity.drawAt).getTime() <= now
  );
}

async function processDueDraws() {
  return enqueueBackgroundMutation(async () => {
    await processPendingDrawReminders();
    const processed = await withDbWrite(async db => {
      const results = [];
      for (const activity of dueTimeActivities(db)) {
        const winners = activity.drawMode === 'instant' ? [] : drawWinners(db, activity);
        activity.status = winners.length ? 'drawn' : 'ended';
        activity.updatedAt = nowIso();
        results.push({ activity, winners });
      }
      return results;
    });
    for (const item of processed) {
      await dispatchActivityDrawNotifications(item.activity.id);
    }
    await processPendingDrawNotifications();
    return processed;
  });
}

app.get('/', (req, res) => {
  res.redirect('/mini');
});

app.get('/mini', (req, res) => {
  res.sendFile(path.join(publicDir, 'mini.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(publicDir, hasAdminAccess(req) ? 'admin.html' : 'admin-login.html'));
});

app.get('/api/integrations/capabilities', (req, res) => {
  res.json(ok(integrationCapabilities()));
});

app.get('/api/public/entry', (req, res) => {
  res.json(ok(publicMiniProgramEntry()));
});

app.post('/api/admin/session', loginRateLimiter, (req, res) => {
  if (!adminToken) return res.json(ok({ authenticated: true, expiresAt: null }));
  if (!safeTextEquals(String(req.body?.token || '').trim(), adminToken)) {
    return fail(res, 401, '后台访问未授权');
  }
  setAdminSessionCookie(res, req);
  return res.json(ok({ authenticated: true, expiresAt: Date.now() + adminSessionLifetimeMs }));
});

app.delete('/api/admin/session', (req, res) => {
  if (!hasAdminAccess(req)) return fail(res, 401, '后台访问未授权');
  res.clearCookie('admin_session', { httpOnly: true, sameSite: 'strict', path: '/' });
  return res.json(ok({ loggedOut: true }));
});

app.get('/api/integrations/official-accounts', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  const accounts = db.officialAccountAuthorizations
    .filter(item => item.memberOpenid === member.openid && item.status === 'active')
    .map(publicOfficialAccountAuthorization);
  if (integrationCapabilities().officialAccount.configured) {
    accounts.push({
      key: officialAccountAppId,
      appid: officialAccountAppId,
      name: officialAccountName,
      username: officialAccountUsername,
      avatar: '',
      principalName: '',
      status: 'active',
      authorizedAt: null,
      source: 'platform'
    });
  }
  res.json(ok(accounts));
});

app.post('/api/integrations/official-accounts/authorization', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  if (!wechatOpenPlatformConfigured()) {
    return fail(res, 409, '请先在微信开放平台创建并配置第三方平台');
  }
  if (!db.wechatOpenPlatform?.componentVerifyTicket) {
    return fail(res, 409, '尚未收到微信开放平台验证票据，请检查授权事件接收地址');
  }
  const state = signWechatOpenState(member.openid);
  res.json(ok({
    url: `${wechatOpenPublicBaseUrl}/wechat/official-account/authorize?state=${encodeURIComponent(state)}`
  }));
});

app.get('/wechat/official-account/authorize', async (req, res) => {
  try {
    const state = String(req.query.state || '');
    const payload = verifyWechatOpenState(state);
    const db = await readDb();
    if (!db.members.some(item => item.openid === payload.memberOpenid)) {
      return res.status(401).type('text/plain').send('authorization member not found');
    }
    const preAuthCode = await createWechatOpenPreAuthCode();
    res.redirect(302, buildWechatOpenAuthorizationUrl(preAuthCode, state));
  } catch (error) {
    res.status(error.status || 502).type('text/plain').send(error.message || 'authorization failed');
  }
});

function escapeWechatOpenHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sendWechatOpenAuthorizationResult(res, { success, title, detail }) {
  const color = success ? '#18a56a' : '#df423a';
  res.type('html').send(`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${escapeWechatOpenHtml(title)}</title><style>
body{margin:0;background:#f3f3f3;color:#171717;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
.panel{margin:18vh 24px 0;padding:36px 24px;border-radius:12px;background:#fff;text-align:center}
.mark{width:56px;height:56px;margin:0 auto 22px;border-radius:50%;color:#fff;background:${color};font-size:34px;line-height:56px}
h1{margin:0 0 14px;font-size:22px}p{margin:0;color:#777;font-size:15px;line-height:1.7}
</style></head><body><main class="panel"><div class="mark">${success ? '✓' : '!'}</div>
<h1>${escapeWechatOpenHtml(title)}</h1><p>${escapeWechatOpenHtml(detail)}</p></main></body></html>`);
}

app.get('/api/wechat/open-platform/authorization/callback', async (req, res) => {
  try {
    const state = verifyWechatOpenState(req.query.state);
    const authorizationCode = String(req.query.auth_code || req.query.authorization_code || '').trim();
    if (!authorizationCode) {
      const error = new Error('微信未返回公众号授权码');
      error.status = 400;
      throw error;
    }
    await exchangeWechatOpenAuthorizationCode(authorizationCode, state.memberOpenid);
    sendWechatOpenAuthorizationResult(res, {
      success: true,
      title: '公众号授权成功',
      detail: '请返回小程序，授权账号会自动显示在列表中。'
    });
  } catch (error) {
    sendWechatOpenAuthorizationResult(res.status(error.status || 502), {
      success: false,
      title: '公众号授权未完成',
      detail: error.message || '请返回小程序重新发起授权。'
    });
  }
});

app.post('/api/wechat/open-platform/component/callback', async (req, res) => {
  try {
    const message = decryptWechatOpenMessage(req.body, req.query);
    await recordWechatOpenPlatformEvent(message);
    res.type('text/plain').send('success');
  } catch (error) {
    console.error('WeChat open-platform component callback failed:', error.message);
    res.status(error.status || 500).type('text/plain').send('failed');
  }
});

app.post('/api/wechat/open-platform/message/:appid', async (req, res) => {
  try {
    const appid = String(req.params.appid || '').trim();
    const message = decryptWechatOpenMessage(req.body, req.query);
    await recordOfficialAccountEvent(message, { appid, authorized: true });
    res.type('text/plain').send('success');
  } catch (error) {
    console.error('WeChat open-platform account callback failed:', error.message);
    res.status(error.status || 500).type('text/plain').send('failed');
  }
});

app.get('/api/integrations/wecom/groups', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  if (!integrationCapabilities().wecom.configured) return fail(res, 409, '企业微信服务尚未完成配置');
  res.json(ok(db.wecomGroups
    .filter(item => item.corpId === wecomCorpId)
    .map(item => ({ id: item.id, name: item.name, memberCount: item.memberCount }))));
});

app.get('/api/wechat/official-account/callback', (req, res) => {
  if (!verifyWechatCallbackSignature(req.query)) return res.status(403).send('invalid signature');
  res.type('text/plain').send(String(req.query.echostr || ''));
});

app.post('/api/wechat/official-account/callback', async (req, res) => {
  if (!verifyWechatCallbackSignature(req.query)) return res.status(403).send('invalid signature');
  try {
    const parser = new XMLParser({ ignoreAttributes: true, trimValues: true, parseTagValue: false });
    const message = parser.parse(String(req.body || '')).xml || {};
    await recordOfficialAccountEvent(message);
    res.type('text/plain').send('success');
  } catch (error) {
    console.error('Official account callback failed:', error.message);
    res.status(500).type('text/plain').send('failed');
  }
});

app.use('/api/admin', requireAdmin);

app.get('/api/health', async (req, res) => {
  const db = await readDb();
  res.json(ok({
    status: 'up',
    storage: dataStore.backend,
    release: String(process.env.RELEASE_VERSION || '1.4.5').trim(),
    activities: db.activities.length,
    participants: db.participants.length,
    winners: db.winners.length
  }));
});

app.get('/api/activities', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  const bundles = db.activities
    .filter(isPublicActivity)
    .map(activity => getActivityBundle(db, activity.id));
  res.json(ok(bundles.map(bundle => publicActivity(bundle, member))));
});

app.get('/api/home', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  const bundles = db.activities
    .filter(activity => isHomeActivityAvailable(activity))
    .map(activity => getActivityBundle(db, activity.id))
    .filter(Boolean)
    .sort((a, b) => Number(b.homePriority || 0) - Number(a.homePriority || 0) ||
      new Date(a.drawAt).getTime() - new Date(b.drawAt).getTime());

  const officialSource = bundles.filter(item =>
    item.homePlacement === 'official' || item.promotion?.platformRecommend === true
  );
  const official = officialSource
    .slice(0, 8)
    .map(bundle => publicActivity(bundle, member));

  const cash = bundles
    .filter(item => item.homePlacement === 'cash' || item.prizes.some(prize => prize.type === '红包'))
    .slice(0, 12)
    .map(bundle => {
      const activity = publicActivity(bundle, member);
      const redPacket = bundle.prizes.find(prize => prize.type === '红包') || bundle.prizes[0];
      return {
        ...activity,
        cashAmount: Number(redPacket?.faceValue || 0),
        cashQuantity: Number(redPacket?.quantity || 0)
      };
    });

  const excluded = new Set([...official, ...cash].map(item => item.id));
  const dailySource = bundles.filter(item =>
    item.homePlacement === 'daily' || (!excluded.has(item.id) && item.homePlacement !== 'cash')
  );
  const today = dailySource.slice(0, 30).map(bundle => publicActivity(bundle, member));
  res.json(ok({ official, cash, today }));
});

app.get('/api/mall', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  const activities = db.activities
    .filter(activity => isPublicActivity(activity) && activity.status === 'live')
    .map(activity => getActivityBundle(db, activity.id))
    .filter(bundle => bundle && bundle.prizes.some(prize => prize.type === '商城奖品'))
    .map(bundle => publicActivity(bundle, member));
  res.json(ok(activities));
});

app.post('/api/payments/wechat/advanced-feature', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  if (advancedFeaturePriceCents <= 0) return fail(res, 409, '当前环境无需创建高级功能支付订单');
  if (!wechatPayConfigured()) return fail(res, 409, '微信支付商户能力尚未完成配置');

  const reusableOrder = db.orders.find(item =>
    item.memberOpenid === member.openid &&
    item.purpose === 'advanced_activity' &&
    item.status === 'pending' &&
    item.paymentPrepayId &&
    !item.consumedAt &&
    Date.now() - new Date(item.createdAt).getTime() < 2 * 60 * 60 * 1000
  );
  if (reusableOrder) {
    try {
      return res.json(ok({
        orderId: reusableOrder.id,
        amount: Number(reusableOrder.amount || 0),
        paymentParams: await buildMiniProgramPaymentParameters(reusableOrder.paymentPrepayId)
      }));
    } catch (error) {
      return fail(res, 502, error.message || '微信支付参数生成失败');
    }
  }

  const orderId = createId('order');
  const outTradeNo = `LT${Date.now().toString(36)}${crypto.randomBytes(6).toString('hex')}`.slice(0, 32);
  const createdAt = nowIso();
  await withDbWrite(async current => {
    current.orders.unshift({
      id: orderId,
      memberOpenid: member.openid,
      title: '单场抽奖高级功能',
      type: 'advanced_feature',
      purpose: 'advanced_activity',
      amount: advancedFeaturePriceCents / 100,
      amountCents: advancedFeaturePriceCents,
      status: 'creating',
      paymentProvider: 'wechat_pay_v3',
      paymentOutTradeNo: outTradeNo,
      createdAt,
      updatedAt: createdAt
    });
  });

  try {
    const payment = await requestWechatPay('POST', '/v3/pay/transactions/jsapi', {
      appid: wechatAppId,
      mchid: wechatPayMchId,
      description: '抽奖工具-单场抽奖高级功能',
      out_trade_no: outTradeNo,
      notify_url: wechatPayNotifyUrl,
      amount: { total: advancedFeaturePriceCents, currency: 'CNY' },
      payer: { openid: member.openid },
      attach: JSON.stringify({ orderId, purpose: 'advanced_activity' })
    });
    if (!payment.prepay_id) throw new Error('微信支付未返回预支付标识');
    const paymentParams = await buildMiniProgramPaymentParameters(payment.prepay_id);
    await withDbWrite(async current => {
      const order = current.orders.find(item => item.id === orderId);
      if (order) {
        order.status = 'pending';
        order.paymentPrepayId = payment.prepay_id;
        order.updatedAt = nowIso();
      }
    });
    return res.json(ok({
      orderId,
      amount: advancedFeaturePriceCents / 100,
      paymentParams
    }));
  } catch (error) {
    await withDbWrite(async current => {
      const order = current.orders.find(item => item.id === orderId);
      if (order) {
        order.status = 'failed';
        order.paymentError = String(error.message || '').slice(0, 200);
        order.updatedAt = nowIso();
      }
    });
    return fail(res, error.status || 502, error.message || '微信支付下单失败');
  }
});

app.get('/api/payments/orders/:id', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  const order = db.orders.find(item => item.id === req.params.id && item.memberOpenid === member.openid);
  if (!order) return fail(res, 404, '支付订单不存在');
  res.json(ok(publicPaymentOrder(order)));
});

app.post('/api/payments/orders/:id/sync', async (req, res) => {
  if (!wechatPayConfigured()) return fail(res, 409, '微信支付商户能力尚未完成配置');
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  const order = db.orders.find(item => item.id === req.params.id && item.memberOpenid === member.openid);
  if (!order) return fail(res, 404, '支付订单不存在');
  if (!['creating', 'pending'].includes(order.status)) {
    return res.json(ok(publicPaymentOrder(order)));
  }

  let transaction;
  try {
    const pathname = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(order.paymentOutTradeNo)}?mchid=${encodeURIComponent(wechatPayMchId)}`;
    transaction = await requestWechatPay('GET', pathname);
  } catch (error) {
    if (error.wechatCode === 'ORDER_NOT_EXIST') return res.json(ok(publicPaymentOrder(order)));
    return fail(res, error.status || 502, error.message || '微信支付订单查询失败');
  }

  try {
    const updated = await withDbWrite(async current => {
      const currentOrder = current.orders.find(item => item.id === order.id && item.memberOpenid === member.openid);
      if (!currentOrder) throw new Error('支付订单不存在');
      if (transaction.trade_state === 'SUCCESS') {
        applyWechatPaymentTransaction(currentOrder, transaction);
      } else if (['CLOSED', 'REVOKED', 'PAYERROR'].includes(transaction.trade_state)) {
        currentOrder.status = transaction.trade_state === 'CLOSED' ? 'closed' : 'failed';
        currentOrder.paymentTradeState = transaction.trade_state;
        currentOrder.updatedAt = nowIso();
      }
      return currentOrder;
    });
    return res.json(ok(publicPaymentOrder(updated)));
  } catch (error) {
    return fail(res, 400, error.message || '微信支付订单校验失败');
  }
});

app.post('/api/payments/wechat/notify', async (req, res) => {
  if (!wechatPayConfigured()) {
    return res.status(503).json({ code: 'FAIL', message: '微信支付商户能力尚未完成配置' });
  }
  try {
    const transaction = await verifyWechatPayNotification(req);
    if (transaction.trade_state !== 'SUCCESS') {
      return res.json({ code: 'SUCCESS', message: '非成功交易无需入账' });
    }
    await withDbWrite(async db => {
      const order = db.orders.find(item => item.paymentOutTradeNo === transaction.out_trade_no);
      if (!order) throw new Error('支付订单不存在');
      applyWechatPaymentTransaction(order, transaction);
      return order;
    });
    return res.json({ code: 'SUCCESS', message: '成功' });
  } catch (error) {
    return res.status(401).json({ code: 'FAIL', message: String(error.message || '回调处理失败').slice(0, 120) });
  }
});

const imageUploadTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp']
]);

function imageBufferMatchesMimeType(mimeType, buffer) {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/webp') {
    return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

async function persistUploadedImage(mimeType, buffer) {
  const normalizedType = String(mimeType || '').trim().toLowerCase();
  if (!imageUploadTypes.has(normalizedType)) {
    const error = new Error('仅支持 JPG、PNG 或 WebP 图片');
    error.statusCode = 400;
    throw error;
  }
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 5 * 1024 * 1024) {
    const error = new Error('图片大小不能超过 5MB');
    error.statusCode = 400;
    throw error;
  }
  if (!imageBufferMatchesMimeType(normalizedType, buffer)) {
    const error = new Error('图片文件格式无效');
    error.statusCode = 400;
    throw error;
  }

  await fs.mkdir(uploadDir, { recursive: true });
  const filename = `${createId('image')}${imageUploadTypes.get(normalizedType)}`;
  await fs.writeFile(path.join(uploadDir, filename), buffer);
  return { url: `/uploads/${filename}` };
}

async function persistTaskProofImage(mimeType, buffer) {
  const normalizedType = String(mimeType || '').trim().toLowerCase();
  if (!imageUploadTypes.has(normalizedType)) {
    const error = new Error('仅支持 JPG、PNG 或 WebP 图片');
    error.statusCode = 400;
    throw error;
  }
  if (!Buffer.isBuffer(buffer) || buffer.length < 8 || buffer.length > 5 * 1024 * 1024) {
    const error = new Error('图片大小必须在 8 字节到 5MB 之间');
    error.statusCode = 400;
    throw error;
  }
  const proofId = createId('task_proof');
  const filename = `${proofId}${imageUploadTypes.get(normalizedType)}`;
  await fs.mkdir(taskProofDir, { recursive: true });
  await fs.writeFile(path.join(taskProofDir, filename), buffer);
  return { proofId, filename, mimeType: normalizedType };
}

function taskProgressPayload(record) {
  return {
    status: record?.status || 'not_started',
    startedAt: record?.startedAt || null,
    readyAt: record?.readyAt || null,
    completedAt: record?.completedAt || null,
    submittedAt: record?.submittedAt || null,
    reviewedAt: record?.reviewedAt || null,
    reviewNote: record?.reviewNote || '',
    proofSubmitted: Boolean(record?.proofId),
    proofNote: record?.proofNote || ''
  };
}

async function readLimitedRequestBody(req, maxBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('图片大小不能超过 5MB');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseMultipartImage(req, body, fieldName = 'file') {
  const contentType = String(req.headers['content-type'] || '');
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = String(boundaryMatch?.[1] || boundaryMatch?.[2] || '').trim();
  if (!boundary || boundary.length > 200) {
    const error = new Error('上传请求格式无效');
    error.statusCode = 400;
    throw error;
  }

  const marker = Buffer.from(`--${boundary}`);
  const partDelimiter = Buffer.from(`\r\n--${boundary}`);
  const headerDelimiter = Buffer.from('\r\n\r\n');
  let cursor = body.indexOf(marker);
  while (cursor >= 0) {
    cursor += marker.length;
    if (body.subarray(cursor, cursor + 2).toString('ascii') === '--') break;
    if (body.subarray(cursor, cursor + 2).toString('ascii') === '\r\n') cursor += 2;

    const headerEnd = body.indexOf(headerDelimiter, cursor);
    if (headerEnd < 0) break;
    const dataStart = headerEnd + headerDelimiter.length;
    const dataEnd = body.indexOf(partDelimiter, dataStart);
    if (dataEnd < 0) break;

    const headers = body.subarray(cursor, headerEnd).toString('latin1');
    const fieldMatch = headers.match(/content-disposition:[^\r\n]*\bname="([^"]+)"/i);
    if (fieldMatch?.[1] === fieldName) {
      const mimeMatch = headers.match(/content-type:\s*([^\r\n;]+)/i);
      return {
        mimeType: String(mimeMatch?.[1] || '').trim().toLowerCase(),
        buffer: body.subarray(dataStart, dataEnd)
      };
    }
    cursor = body.indexOf(marker, dataEnd + 2);
  }

  const error = new Error('未找到头像文件');
  error.statusCode = 400;
  throw error;
}

function parseMultipartTextField(req, body, fieldName) {
  const contentType = String(req.headers['content-type'] || '');
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = String(boundaryMatch?.[1] || boundaryMatch?.[2] || '').trim();
  if (!boundary || boundary.length > 200) return '';
  const marker = Buffer.from(`--${boundary}`);
  const partDelimiter = Buffer.from(`\r\n--${boundary}`);
  const headerDelimiter = Buffer.from('\r\n\r\n');
  let cursor = body.indexOf(marker);
  while (cursor >= 0) {
    cursor += marker.length;
    if (body.subarray(cursor, cursor + 2).toString('ascii') === '--') break;
    if (body.subarray(cursor, cursor + 2).toString('ascii') === '\r\n') cursor += 2;
    const headerEnd = body.indexOf(headerDelimiter, cursor);
    if (headerEnd < 0) break;
    const dataStart = headerEnd + headerDelimiter.length;
    const dataEnd = body.indexOf(partDelimiter, dataStart);
    if (dataEnd < 0) break;
    const headers = body.subarray(cursor, headerEnd).toString('latin1');
    const fieldMatch = headers.match(/content-disposition:[^\r\n]*\bname="([^"]+)"/i);
    if (fieldMatch?.[1] === fieldName) return body.subarray(dataStart, dataEnd).toString('utf8');
    cursor = body.indexOf(marker, dataEnd + 2);
  }
  return '';
}

app.post('/api/uploads/image', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');

  let mimeType = String(req.body?.mimeType || '').trim().toLowerCase();
  let base64 = String(req.body?.base64 || req.body?.data || '').trim();
  const dataUrl = base64.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i);
  if (dataUrl) {
    mimeType = dataUrl[1].toLowerCase();
    base64 = dataUrl[2];
  }
  base64 = base64.replace(/\s+/g, '');
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return fail(res, 400, '图片数据无效');

  try {
    const uploaded = await persistUploadedImage(mimeType, Buffer.from(base64, 'base64'));
    return res.json(ok(uploaded));
  } catch (error) {
    return fail(res, Number(error.statusCode || 400), error.message || '图片上传失败');
  }
});

app.post('/api/uploads/image-file', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');

  try {
    const body = await readLimitedRequestBody(req, 5 * 1024 * 1024 + 128 * 1024);
    const image = parseMultipartImage(req, body);
    const uploaded = await persistUploadedImage(image.mimeType, image.buffer);
    return res.json(ok(uploaded));
  } catch (error) {
    return fail(res, Number(error.statusCode || 400), error.message || '图片上传失败');
  }
});

app.post('/api/activities/:id/task/proof', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  const activity = db.activities.find(item => item.id === req.params.id);
  if (!activity || activity.status !== 'live') return fail(res, 409, '活动当前不可提交任务凭证');
  const conditions = normalizeParticipationConditions(activity.conditions);
  if (!conditions.task || !conditions.taskProofRequired) return fail(res, 409, '当前活动不要求上传任务凭证');
  const task = db.activityTasks.find(item => item.activityId === activity.id && item.memberOpenid === member.openid);
  if (!task || !['started', 'rejected'].includes(task.status)) {
    return fail(res, 409, '请先开始任务，或等待当前审核结束');
  }
  try {
    const body = await readLimitedRequestBody(req, 5 * 1024 * 1024 + 128 * 1024);
    const image = parseMultipartImage(req, body);
    const proofNote = parseMultipartTextField(req, body, 'proofNote');
    const uploaded = await persistTaskProofImage(image.mimeType, image.buffer);
    const previousFilename = String(task.proofFilename || '');
    task.proofId = uploaded.proofId;
    task.proofFilename = uploaded.filename;
    task.proofMimeType = uploaded.mimeType;
    task.proofNote = String(proofNote || '').trim().slice(0, 160);
    task.proofUploadedAt = nowIso();
    task.updatedAt = task.proofUploadedAt;
    await writeDb(db);
    if (/^task_proof_[a-z0-9_]+\.(?:jpg|png|webp)$/i.test(previousFilename)) {
      fs.unlink(path.join(taskProofDir, previousFilename)).catch(() => {});
    }
    return res.json(ok({ proofSubmitted: true, proofUploadedAt: task.proofUploadedAt }));
  } catch (error) {
    return fail(res, Number(error.statusCode || 400), error.message || '任务凭证上传失败');
  }
});

app.get('/api/activities/:id', async (req, res) => {
  const db = await readDb();
  const bundle = getActivityBundle(db, req.params.id);
  if (!bundle || !isPublicActivity(bundle)) return fail(res, 404, '活动不存在');
  res.json(ok(publicActivity(bundle, sessionMember(db, req))));
});

app.post('/api/activities/:id/view', async (req, res) => {
  const result = await withDbWrite(async db => {
    const activity = db.activities.find(item => item.id === req.params.id);
    if (!activity || !isPublicActivity(activity)) return { error: [404, '活动不存在'] };
    const member = sessionMember(db, req);
    const viewerKey = member?.openid || String(req.body?.viewerKey || '').trim().slice(0, 96);
    if (!viewerKey) return { error: [400, '缺少访问标识'] };
    const dateKey = shanghaiDateKey();
    const existing = db.activityViews.find(item =>
      item.activityId === activity.id && item.viewerKey === viewerKey && item.dateKey === dateKey
    );
    if (!existing) {
      db.activityViews.unshift({
        id: createId('view'),
        activityId: activity.id,
        viewerKey,
        memberOpenid: member?.openid || '',
        dateKey,
        createdAt: nowIso()
      });
    }
    return {
      recorded: !existing,
      viewCount: db.activityViews.filter(item => item.activityId === activity.id).length
    };
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.post('/api/activities/:id/share', async (req, res) => {
  const result = await withDbWrite(async db => {
    const activity = db.activities.find(item => item.id === req.params.id);
    if (!activity || !isPublicActivity(activity)) return { error: [404, '活动不存在'] };
    const member = sessionMember(db, req);
    db.shares.unshift({
      id: createId('share'),
      activityId: activity.id,
      memberOpenid: member?.openid || '',
      channel: String(req.body?.channel || 'wechat').trim().slice(0, 32),
      createdAt: nowIso()
    });
    return { shareCount: db.shares.filter(item => item.activityId === activity.id).length };
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.post('/api/activities/:id/comments', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const activity = db.activities.find(item => item.id === req.params.id);
    if (!activity) return { error: [404, '活动不存在'] };
    const advanced = normalizeAdvanced(activity.advanced);
    if (!advanced.enabled || !advanced.comments) return { error: [409, '该活动未开启留言'] };
    const content = String(req.body?.content || '').trim().slice(0, 200);
    if (!content) return { error: [400, '请输入留言内容'] };
    const comment = {
      id: createId('comment'),
      activityId: activity.id,
      memberOpenid: member.openid,
      nickname: member.nickname || '微信用户',
      content,
      status: 'visible',
      createdAt: nowIso()
    };
    db.comments.unshift(comment);
    return comment;
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  await dispatchActivityCommentNotification(result.id);
  res.json(ok(result));
});

app.post('/api/activities/:id/creator-subscription', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const activity = db.activities.find(item => item.id === req.params.id);
    if (!activity?.creatorOpenid) return { error: [409, '该活动暂不支持订阅发起人'] };
    const subscribed = req.body?.subscribed !== false;
    const index = db.creatorSubscriptions.findIndex(item =>
      item.creatorOpenid === activity.creatorOpenid && item.memberOpenid === member.openid
    );
    if (subscribed && index < 0) {
      db.creatorSubscriptions.unshift({
        id: createId('creator_sub'),
        creatorOpenid: activity.creatorOpenid,
        memberOpenid: member.openid,
        createdAt: nowIso()
      });
    }
    if (!subscribed && index >= 0) db.creatorSubscriptions.splice(index, 1);
    return { subscribed };
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.post('/api/activities/:id/task/start', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const activity = db.activities.find(item => item.id === req.params.id);
    if (!activity) return { error: [404, '活动不存在'] };
    if (activity.status !== 'live') return { error: [409, '活动当前不可完成参与任务'] };
    const conditions = normalizeParticipationConditions(activity.conditions);
    if (!conditions.task) return { error: [409, '当前活动未配置参与前任务'] };
    let record = db.activityTasks.find(item =>
      item.activityId === activity.id && item.memberOpenid === member.openid
    );
    if (!record) {
      const startedAt = nowIso();
      const requiredDurationMs = activityTaskMinDurationMs === null
        ? conditions.taskDurationSeconds * 1000
        : activityTaskMinDurationMs;
      record = {
        id: createId('activity_task'),
        activityId: activity.id,
        memberOpenid: member.openid,
        taskText: conditions.taskText,
        status: 'started',
        startedAt,
        readyAt: new Date(Date.parse(startedAt) + requiredDurationMs).toISOString(),
        completedAt: null,
        submittedAt: null,
        reviewedAt: null,
        reviewNote: '',
        proofId: '',
        proofFilename: '',
        proofMimeType: '',
        proofUploadedAt: null,
        proofNote: '',
        createdAt: startedAt,
        updatedAt: startedAt
      };
      db.activityTasks.unshift(record);
    }
    return taskProgressPayload(record);
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.post('/api/activities/:id/task/complete', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const activity = db.activities.find(item => item.id === req.params.id);
    if (!activity) return { error: [404, '活动不存在'] };
    const conditions = normalizeParticipationConditions(activity.conditions);
    if (!conditions.task) return { error: [409, '当前活动未配置参与前任务'] };
    const record = db.activityTasks.find(item =>
      item.activityId === activity.id && item.memberOpenid === member.openid
    );
    if (!record) return { error: [409, '请先打开并体验指定任务'] };
    if (record.status === 'completed' || record.status === 'pending') return taskProgressPayload(record);
    const readyAt = Date.parse(record.readyAt || '');
    if (!Number.isFinite(readyAt) || Date.now() < readyAt) {
      const remainingSeconds = Math.max(1, Math.ceil((readyAt - Date.now()) / 1000));
      return { error: [409, `请继续体验任务 ${remainingSeconds} 秒后再确认完成`] };
    }
    if (conditions.taskProofRequired) {
      if (!record.proofId || !record.proofFilename) {
        return { error: [400, '请先上传清晰的任务完成凭证'] };
      }
      try {
        await fs.access(path.join(taskProofDir, record.proofFilename));
      } catch {
        return { error: [400, '任务凭证不存在，请重新上传'] };
      }
      record.status = 'pending';
      record.submittedAt = nowIso();
      record.reviewedAt = null;
      record.reviewNote = '';
      record.updatedAt = record.submittedAt;
      return taskProgressPayload(record);
    }
    record.status = 'completed';
    record.completedAt = nowIso();
    record.updatedAt = record.completedAt;
    return taskProgressPayload(record);
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.get('/api/activities/:id/events', async (req, res) => {
  const db = await readDb();
  const activity = db.activities.find(item => item.id === req.params.id);
  if (!activity || !isPublicActivity(activity)) return fail(res, 404, '活动不存在');
  const after = Math.max(0, Number(req.query.after || 0));
  const events = db.activityEvents
    .filter(item => item.activityId === activity.id && Number(item.sequence || 0) > after)
    .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0))
    .slice(0, 100);
  res.json(ok(events));
});

app.post('/api/activities/:id/events', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const activity = db.activities.find(item => item.id === req.params.id);
    if (!activity) return { error: [404, '活动不存在'] };
    if (activity.creatorOpenid !== member.openid) return { error: [403, '仅活动发起人可发布互动事件'] };
    const allowedTypes = ['screen_message', 'draw_control', 'winner_reveal'];
    const type = String(req.body?.type || 'screen_message');
    if (!allowedTypes.includes(type)) return { error: [400, '互动事件类型无效'] };
    let payload = {};
    if (req.body?.payload && typeof req.body.payload === 'object') {
      const serializedPayload = JSON.stringify(req.body.payload);
      if (serializedPayload.length > 4000) return { error: [413, '互动事件内容不能超过 4000 个字符'] };
      payload = JSON.parse(serializedPayload);
    }
    return appendActivityEvent(db, activity.id, type, payload);
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.all('/api/me/check-in', (req, res) => fail(res, 404, '接口不存在'));

app.post('/api/activities/:id/check-in/start', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const activity = db.activities.find(item => item.id === req.params.id);
    if (!activity) return { error: [404, '活动不存在'] };
    if (activity.status !== 'live') return { error: [409, '活动当前不可完成打卡任务'] };
    const participant = db.participants.find(item =>
      item.activityId === activity.id && item.memberOpenid === member.openid
    );
    if (!participant) return { error: [403, '请先参与抽奖，再完成打卡任务'] };
    const conditions = normalizeParticipationConditions(activity.conditions);
    const task = conditions.checkInTask;
    if (!conditions.checkIn || !isCheckInTaskConfigured(task)) {
      return { error: [409, '当前活动未配置打卡任务'] };
    }
    let record = db.checkIns.find(item =>
      item.activityId === activity.id && item.memberOpenid === member.openid && item.taskId === task.id
    );
    if (!record) {
      const startedAt = nowIso();
      const requiredDurationMs = checkInTaskMinDurationMs === null
        ? task.durationSeconds * 1000
        : checkInTaskMinDurationMs;
      record = {
        id: createId('checkin'),
        activityId: activity.id,
        participantId: participant.id,
        memberOpenid: member.openid,
        taskId: task.id,
        taskType: task.type,
        status: 'started',
        rewardMultiplier: null,
        startedAt,
        readyAt: new Date(Date.parse(startedAt) + requiredDurationMs).toISOString(),
        completedAt: null,
        createdAt: startedAt,
        updatedAt: startedAt
      };
      db.checkIns.unshift(record);
    }
    return publicCheckInTaskProgress(record, task);
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.post('/api/activities/:id/check-in/complete', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const activity = db.activities.find(item => item.id === req.params.id);
    if (!activity) return { error: [404, '活动不存在'] };
    if (activity.status !== 'live') return { error: [409, '活动当前不可完成打卡任务'] };
    const participant = db.participants.find(item =>
      item.activityId === activity.id && item.memberOpenid === member.openid
    );
    if (!participant) return { error: [403, '请先参与抽奖，再完成打卡任务'] };
    const conditions = normalizeParticipationConditions(activity.conditions);
    const task = conditions.checkInTask;
    if (!conditions.checkIn || !isCheckInTaskConfigured(task)) {
      return { error: [409, '当前活动未配置打卡任务'] };
    }
    const record = db.checkIns.find(item =>
      item.activityId === activity.id && item.memberOpenid === member.openid && item.taskId === task.id
    );
    if (!record) return { error: [409, '请先打开并体验打卡任务'] };
    if (record.status === 'completed') return publicCheckInTaskProgress(record, task);
    const readyAt = Date.parse(record.readyAt || '');
    if (!Number.isFinite(readyAt) || Date.now() < readyAt) {
      const remainingSeconds = Math.max(1, Math.ceil((readyAt - Date.now()) / 1000));
      return { error: [409, `请继续体验任务 ${remainingSeconds} 秒后再完成打卡`] };
    }
    record.status = 'completed';
    record.rewardMultiplier = createCheckInRewardWeight(task);
    record.completedAt = nowIso();
    record.updatedAt = record.completedAt;
    return publicCheckInTaskProgress(record, task);
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.post('/api/activities', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  const data = normalizePublicCreateInput(req.body || {});
  if (data.activity.drawMode === 'people' && data.activity.drawParticipantTarget < 1) {
    return fail(res, 400, '请设置按人数开奖的目标人数');
  }
  if (data.activity.drawMode === 'people' && data.activity.drawParticipantTarget < data.prizes.reduce((sum, prize) => sum + prize.quantity, 0)) {
    return fail(res, 400, '按人数开奖的目标人数不能少于奖品总份数');
  }
  if (data.activity.drawMode === 'instant' && (data.activity.conditions.assist || data.activity.conditions.checkIn)) {
    return fail(res, 400, '即抽即中不支持助力或打卡加权');
  }
  const drawAtTimestamp = new Date(data.activity.drawAt).getTime();
  if (!Number.isFinite(drawAtTimestamp) || drawAtTimestamp <= Date.now()) {
    return fail(res, 400, data.activity.drawMode === 'instant' ? '请设置有效的抽奖截止时间' : '请设置有效的开奖时间');
  }
  if (!data.activity.title) return fail(res, 400, '请输入奖品名称');
  if (!data.prizes.length || data.prizes.some(item => !item.name)) {
    return fail(res, 400, '请完整填写所有奖项名称');
  }
  if (data.prizes.some(item => ['红包', '优惠券'].includes(item.type) && item.faceValue <= 0)) {
    return fail(res, 400, '请填写红包或优惠券的有效面额');
  }
  if (data.activity.unlockByPeople) {
    if (data.activity.drawMode === 'instant') {
      return fail(res, 400, '即抽即中不支持按人数依次解锁奖品');
    }
    if (data.prizes.length < 2) return fail(res, 400, '按人数解锁至少需要两个奖项');
    const thresholds = data.prizes.slice(0, -1).map(item => Number(item.unlockParticipants || 0));
    if (thresholds.some(value => !Number.isInteger(value) || value < 1)) {
      return fail(res, 400, '请填写每个非末等奖项的解锁人数');
    }
    if (thresholds.some((value, index) => index > 0 && value >= thresholds[index - 1])) {
      return fail(res, 400, '高等级奖项的解锁人数必须依次更高');
    }
    if (data.activity.drawMode === 'people' && thresholds.some(value => value > data.activity.drawParticipantTarget)) {
      return fail(res, 400, '奖品解锁人数不能超过开奖人数');
    }
    data.prizes[data.prizes.length - 1].unlockParticipants = 0;
  } else {
    data.prizes.forEach(item => { item.unlockParticipants = 0; });
  }
  if (data.activity.drawMode === 'instant') {
    const rawPerUserLimit = req.body?.instantPerUserLimit;
    const rawParticipantLimit = req.body?.instantParticipantLimit;
    if (rawPerUserLimit !== undefined &&
      (!Number.isInteger(Number(rawPerUserLimit)) || Number(rawPerUserLimit) < 1 || Number(rawPerUserLimit) > 5)) {
      return fail(res, 400, '单人参与次数必须为 1 至 5 次');
    }
    if (rawParticipantLimit !== undefined &&
      (!Number.isInteger(Number(rawParticipantLimit)) || Number(rawParticipantLimit) < 5 || Number(rawParticipantLimit) > 10000)) {
      return fail(res, 400, '参与人数上限必须为 5 至 10000 人');
    }
    const attemptCapacity = data.activity.instantPerUserLimit * data.activity.instantParticipantLimit;
    const prizeCount = data.prizes.reduce((sum, prize) => sum + Number(prize.quantity || 0), 0);
    if (attemptCapacity < prizeCount) return fail(res, 400, '参与次数容量不能少于奖品总份数');
  }
  if (data.activity.conditions.checkIn && !isCheckInTaskConfigured(data.activity.conditions.checkInTask)) {
    return fail(res, 400, '请完整设置打卡任务内容');
  }
  if (data.activity.advanced.enabled && data.activity.advanced.recentWinnerBlock) {
    const allowedActivityIds = new Set(
      recentEndedActivitiesForCreator(db, member.openid, data.activity.advanced.recentWinnerDays)
        .map(item => item.id)
    );
    const selectedActivityIds = data.activity.advanced.recentWinnerActivityIds;
    if (!selectedActivityIds.length) {
      return fail(res, 400, '请先选择用于排除近期中奖者的抽奖');
    }
    if (selectedActivityIds.some(id => !allowedActivityIds.has(id))) {
      return fail(res, 400, '近期中奖范围包含无效或不属于当前账号的抽奖');
    }
  }
  try {
    data.activity.conditions = bindConfiguredParticipationConditions(
      data.activity.conditions,
      req.body?.groupProof,
      member,
      db
    );
  } catch (error) {
    return fail(res, error.status || 400, error.message);
  }

  const activity = {
    id: createId('act'),
    ...data.activity,
    creator: member.nickname,
    creatorOpenid: member.openid,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  const prizes = data.prizes.map(item => ({
    id: createId('prize'),
    activityId: activity.id,
    name: item.name,
    level: item.level,
    type: item.type,
    faceValue: item.faceValue,
    quantity: item.quantity,
    remaining: item.quantity,
    image: item.image,
    deliveryMethod: item.deliveryMethod,
    unlockParticipants: item.unlockParticipants,
    sort: item.sort
  }));

  if (activity.drawMode === 'instant') {
    const maxAttempts = activity.instantParticipantLimit * activity.instantPerUserLimit;
    const prizeCount = prizes.reduce((sum, prize) => sum + Number(prize.quantity || 0), 0);
    activity.instantWinningSlots = buildInstantWinningSlots(maxAttempts, prizeCount);
  }

  db.activities.unshift(activity);
  db.prizes.push(...prizes);
  enqueueCreatorFollowerMessages(db, activity);
  db.memberStats = {
    ...(db.memberStats || {}),
    total: Number(db.memberStats?.total || 0) + 1,
    created: Number(db.memberStats?.created || 0) + 1,
    won: Number(db.memberStats?.won || 0)
  };
  await writeDb(db);

  const bundle = getActivityBundle(db, activity.id);
  res.json(ok(publicActivity(bundle, member)));
});

app.post('/api/auth/wechat-login', loginRateLimiter, async (req, res) => {
  const code = String(req.body?.code || '').trim();
  if (!code) return fail(res, 400, '缺少微信登录凭证');

  try {
    const login = await exchangeWechatCode(code);
    const db = await readDb();
    const { member, sessionId } = upsertWechatSession(db, login, {
      nickname: req.body?.nickname,
      avatar: req.body?.avatar,
      profileConfirmed: req.body?.profileConfirmed === true
    });
    await writeDb(db);
    res.json(ok({
      openid: login.openid,
      unionid: login.unionid || '',
      sessionId,
      profile: publicMemberProfile(member)
    }));
  } catch (error) {
    return fail(res, error.status || 500, error.message || '微信登录失败');
  }
});

app.post('/api/auth/logout', async (req, res) => {
  const sessionId = requestBearerToken(req);
  if (!sessionId) return res.json(ok({ loggedOut: true }));
  await withDbWrite(async db => {
    db.sessions = db.sessions.filter(item => item.id !== sessionId);
  });
  res.json(ok({ loggedOut: true }));
});

app.post('/api/wechat/group-proof', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  const code = String(req.body?.code || '').trim();
  const encryptedData = String(req.body?.encryptedData || '').trim();
  const iv = String(req.body?.iv || '').trim();
  if (!code || !encryptedData || !iv) {
    return fail(res, 400, '缺少微信群身份校验信息');
  }

  try {
    const login = await exchangeWechatCode(code);
    if (login.openid !== member.openid) {
      return fail(res, 403, '微信群身份与当前登录用户不一致');
    }
    const group = decryptWechatGroupInfo(login.session_key, encryptedData, iv);
    res.json(ok({
      groupType: 'wechat',
      groupProof: signGroupProof({ openid: member.openid, openGId: group.openGId })
    }));
  } catch (error) {
    return fail(res, error.status || 500, error.message || '微信群身份校验失败');
  }
});

app.post('/api/me/subscriptions', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const requestedType = ['draw', 'draw_result', 'draw_reminder', 'cash', 'comment'].includes(req.body?.type)
      ? req.body.type
      : 'draw_reminder';
    // Clients before 1.4.0 used "draw" for the appointment button. New requests
    // must use the reminder template, while persisted legacy records keep their result template.
    const type = requestedType === 'draw' ? 'draw_reminder' : requestedType;
    const activityId = String(req.body?.activityId || '').trim();
    const activity = db.activities.find(item => item.id === activityId);
    if (['draw', 'draw_result', 'draw_reminder', 'cash', 'comment'].includes(type) && !activity) {
      return { error: [404, '活动不存在'] };
    }
    if (type === 'comment') {
      if (activity.creatorOpenid !== member.openid) {
        return { error: [403, '只能为自己发起的抽奖开启留言通知'] };
      }
      const advanced = normalizeAdvanced(activity.advanced);
      if (!advanced.enabled || !advanced.comments) {
        return { error: [409, '请先开启活动留言功能'] };
      }
    }
    const template = subscriptionTemplate(type);
    if (!template.id || !parseTemplateData(template.data)) {
      return { error: [409, '订阅消息服务尚未完成配置'] };
    }
    const existed = db.subscriptions.find(item =>
      item.openid === member.openid &&
      item.activityId === activityId &&
      item.type === type &&
      item.status === 'accepted' &&
      !item.sentAt
    );
    if (existed) return { subscription: existed, created: false };
    const subscription = {
      id: createId('sub'),
      openid: member.openid,
      activityId,
      type,
      templateId: template.id,
      status: 'accepted',
      acceptedAt: nowIso(),
      sentAt: null,
      attemptCount: 0,
      lastAttemptAt: null,
      nextAttemptAt: null,
      lastDeliveryStatus: '',
      lastError: ''
    };
    db.subscriptions.unshift(subscription);
    return { subscription, created: true };
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  if (result.subscription?.type === 'draw_reminder' && result.subscription.status === 'accepted') {
    processPendingDrawReminders().catch(error => console.error('Draw reminder dispatch failed:', error.message));
  }
  res.json(ok(result));
});

app.get('/api/me/overview', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  const center = defaultMemberCenter(db, member);
  res.json(ok({
    authenticated: center.authenticated,
    profile: center.profile,
    stats: center.stats,
    wallet: {
      balance: center.wallet.balance,
      frozen: center.wallet.frozen
    },
    couponCount: center.coupons.filter(item => item.status === 'available').length,
    orderCount: center.orders.length,
    premiumActive: true,
    creator: creatorDashboardCounts(db, member)
  }));
});

app.put('/api/me/profile', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const nickname = String(req.body?.nickname || '').trim().slice(0, 16);
    const avatar = String(req.body?.avatar || '').trim().slice(0, 500);
    if (!nickname) return { error: [400, '请输入昵称'] };
    if (avatar && !/^(\/uploads\/|\/assets\/|https:\/\/)/.test(avatar)) {
      return { error: [400, '头像地址无效'] };
    }
    member.nickname = nickname;
    if (avatar) member.avatar = avatar;
    member.profileCompleted = true;
    member.updatedAt = nowIso();
    return publicMemberProfile(member);
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.get('/api/me/check-in', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return res.json(ok({ authenticated: false, checkedIn: false, streak: 0 }));
  const records = db.checkIns
    .filter(item => item.memberOpenid === member.openid)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(ok({
    authenticated: true,
    checkedIn: records.some(item => item.dateKey === shanghaiDateKey()),
    streak: new Set(records.map(item => item.dateKey)).size
  }));
});

app.post('/api/me/check-in', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const dateKey = shanghaiDateKey();
    let record = db.checkIns.find(item => item.memberOpenid === member.openid && item.dateKey === dateKey);
    const created = !record;
    if (!record) {
      record = { id: createId('checkin'), memberOpenid: member.openid, dateKey, createdAt: nowIso() };
      db.checkIns.unshift(record);
    }
    return {
      checkedIn: true,
      created,
      streak: new Set(db.checkIns.filter(item => item.memberOpenid === member.openid).map(item => item.dateKey)).size
    };
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.get('/api/me/premium', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  const payment = {
    configured: false,
    advancedPrice: 0,
    mode: 'free'
  };
  if (!member) return res.json(ok({
    authenticated: false,
    active: true,
    premiumUntil: null,
    payment
  }));
  res.json(ok({
    authenticated: true,
    active: true,
    premiumUntil: null,
    payment
  }));
});

app.get('/api/me/homepage', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  const activities = db.activities
    .filter(item => item.creatorOpenid === member.openid)
    .map(item => getActivityBundle(db, item.id))
    .filter(Boolean)
    .map(bundle => publicActivity(bundle, member));
  res.json(ok({ profile: publicMemberProfile(member), activities }));
});

app.get('/api/me/activities/recent-ended', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  const activities = recentEndedActivitiesForCreator(db, member.openid, 30).map(activity => {
    const prizeNames = db.prizes
      .filter(item => item.activityId === activity.id)
      .map(item => item.name)
      .filter(Boolean)
      .slice(0, 3);
    return {
      id: activity.id,
      title: activity.title,
      image: activity.image || '/assets/cover-phone.svg',
      drawAt: activity.drawAt || activity.endAt || activity.updatedAt,
      completedAt: activity.updatedAt || activity.drawAt || activity.endAt,
      winnerCount: db.winners.filter(item => item.activityId === activity.id).length,
      prizeNames
    };
  });
  res.json(ok({ days: 30, activities }));
});

app.post('/api/me/activities/:id/home-promotion', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const activity = db.activities.find(item => item.id === req.params.id);
    if (!activity) return { error: [404, '抽奖活动不存在'] };
    if (activity.creatorOpenid !== member.openid) return { error: [403, '只能设置自己发起的抽奖'] };

    const enabled = req.body?.enabled === true;
    activity.promotion = normalizePromotion({
      ...activity.promotion,
      platformRecommend: enabled
    });
    if (enabled) {
      activity.homePlacement = 'official';
    } else if (activity.homePlacement === 'official') {
      activity.homePlacement = '';
    }
    activity.updatedAt = nowIso();
    return publicActivity(getActivityBundle(db, activity.id), member);
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.post('/api/me/partnerships', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const contactName = String(req.body?.contactName || '').trim().slice(0, 40);
    const phone = String(req.body?.phone || '').trim().slice(0, 30);
    const company = String(req.body?.company || '').trim().slice(0, 100);
    const needs = String(req.body?.needs || '').trim().slice(0, 500);
    if (!contactName || !phone || !needs) return { error: [400, '请完整填写联系人、联系电话和合作需求'] };
    const application = {
      id: createId('partnership'),
      memberOpenid: member.openid,
      nickname: member.nickname || '微信用户',
      contactName,
      phone,
      company,
      needs,
      status: 'pending',
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    db.partnerships.unshift(application);
    return application;
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.get('/api/me/wallet', async (req, res) => {
  const db = await readDb();
  res.json(ok(defaultMemberCenter(db, sessionMember(db, req)).wallet));
});

app.post('/api/me/withdrawals', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const amount = Math.round(Number(req.body?.amount || 0) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) return { error: [400, '请输入有效的提现金额'] };
    const wallet = defaultMemberCenter(db, member).wallet;
    if (amount > Number(wallet.balance || 0)) return { error: [400, '可提现余额不足'] };
    const record = {
      id: createId('wallet'),
      memberOpenid: member.openid,
      title: '余额提现',
      type: 'withdrawal',
      amount: -amount,
      status: 'pending',
      createdAt: nowIso()
    };
    db.wallet.records.unshift(record);
    return { record, wallet: defaultMemberCenter(db, member).wallet };
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.get('/api/me/coupons', async (req, res) => {
  const db = await readDb();
  res.json(ok(defaultMemberCenter(db, sessionMember(db, req)).coupons));
});

app.get('/api/me/orders', async (req, res) => {
  const db = await readDb();
  res.json(ok(defaultMemberCenter(db, sessionMember(db, req)).orders));
});

app.get('/api/me/address', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return res.json(ok(null));
  res.json(ok(member.address || null));
});

app.put('/api/me/address', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const address = {
      userName: String(req.body?.userName || '').trim(),
      telNumber: String(req.body?.telNumber || '').trim(),
      provinceName: String(req.body?.provinceName || '').trim(),
      cityName: String(req.body?.cityName || '').trim(),
      countyName: String(req.body?.countyName || '').trim(),
      detailInfo: String(req.body?.detailInfo || '').trim(),
      postalCode: String(req.body?.postalCode || '').trim()
    };
    if (!address.userName || !address.telNumber || !address.detailInfo) {
      return { error: [400, '请完整填写收货人、联系电话和详细地址'] };
    }
    member.address = address;
    member.updatedAt = nowIso();
    return { address };
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result.address));
});

app.get('/api/me/messages', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return res.json(ok([]));
  const logBySubscriptionId = new Map(
    db.notificationLogs
      .filter(item => item.openid === member.openid)
      .map(item => [item.subscriptionId, item])
  );
  const subscriptionMessages = db.subscriptions
    .filter(item => item.openid === member.openid)
    .map(subscription => {
      const activity = db.activities.find(item => item.id === subscription.activityId);
      const log = logBySubscriptionId.get(subscription.id);
      return {
        id: subscription.id,
        activityId: subscription.activityId,
        title: subscription.type === 'draw_reminder'
          ? '开奖提醒'
          : (subscription.type === 'cash' ? '现金红包提醒' : '开奖结果通知'),
        content: log?.status === 'sent'
          ? (subscription.type === 'draw_reminder'
            ? `${activity?.title || '抽奖活动'}的开奖提醒已发送`
            : `${activity?.title || '抽奖活动'}的开奖结果已发送`)
          : `已订阅${activity?.title || '抽奖活动'}的${subscription.type === 'draw_reminder' ? '开奖提醒' : '结果通知'}`,
        status: log?.status || subscription.status,
        createdAt: log?.createdAt || subscription.acceptedAt
      };
    });
  const messages = [
    ...db.messages
      .filter(item => item.memberOpenid === member.openid)
      .map(item => ({
        id: item.id,
        activityId: item.activityId || '',
        title: item.title,
        content: item.content,
        status: item.status,
        createdAt: item.createdAt
      })),
    ...subscriptionMessages
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json(ok(messages));
});

app.get('/api/me/records', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return res.json(ok({ created: [], joined: [], won: [] }));

  const createdIds = new Set(db.activities.filter(item => item.creatorOpenid === member.openid).map(item => item.id));
  const joinedParticipantIds = new Set(db.participants.filter(item => item.memberOpenid === member.openid).map(item => item.id));
  const joinedIds = new Set(
    db.participants
      .filter(item => item.memberOpenid === member.openid)
      .map(item => item.activityId)
  );
  const wonIds = new Set(
    db.winners
      .filter(item => joinedParticipantIds.has(item.participantId))
      .map(item => item.activityId)
  );
  const bundleFor = ids => [...ids]
    .map(id => getActivityBundle(db, id))
    .filter(Boolean)
    .map(bundle => publicActivity(bundle, member));

  res.json(ok({
    created: bundleFor(createdIds),
    joined: bundleFor(joinedIds),
    won: bundleFor(wonIds)
  }));
});

app.get('/api/me/creator-activities', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  const activities = db.activities
    .filter(item => hasCreatorPermission(db, member, item.creatorOpenid, 'read'))
    .map(item => ({
      ...creatorActivitySummary(db, item),
      creatorName: db.members.find(candidate => candidate.openid === item.creatorOpenid)?.nickname || item.creator || '发起人',
      ownedByMe: item.creatorOpenid === member.openid,
      canManage: hasCreatorPermission(db, member, item.creatorOpenid, 'manage'),
      canClaim: hasCreatorPermission(db, member, item.creatorOpenid, 'claim')
    }))
    .sort((left, right) => (Date.parse(right.updatedAt) || 0) - (Date.parse(left.updatedAt) || 0));
  res.json(ok({ activities, counts: creatorDashboardCounts(db, member) }));
});

app.patch('/api/me/activities/:id/status', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const activity = db.activities.find(item => item.id === req.params.id);
    if (!activity) return { error: [404, '抽奖活动不存在'] };
    if (!hasCreatorPermission(db, member, activity.creatorOpenid, 'manage')) {
      return { error: [403, '当前账号没有管理该活动的权限'] };
    }
    const status = String(req.body?.status || '').trim();
    if (!['live', 'ended'].includes(status)) return { error: [400, '不支持该活动状态'] };
    if (status === 'live') {
      if (activity.status !== 'draft') return { error: [409, '只有草稿活动可以上线'] };
      if ((Date.parse(activity.drawAt) || 0) <= Date.now()) return { error: [409, '请先将开奖时间调整到未来'] };
    }
    if (status === 'ended' && activity.status !== 'live') {
      return { error: [409, '只有进行中的活动可以结束'] };
    }
    activity.status = status;
    activity.updatedAt = nowIso();
    return creatorActivitySummary(db, activity);
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.get('/api/me/claims', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  const activityById = new Map(db.activities
    .filter(item => hasCreatorPermission(db, member, item.creatorOpenid, 'claim'))
    .map(item => [item.id, item]));
  const claims = db.winners
    .filter(item => activityById.has(item.activityId))
    .map(winner => {
      const participant = db.participants.find(item => item.id === winner.participantId);
      const winnerMember = db.members.find(item => item.openid === participant?.memberOpenid);
      const prize = db.prizes.find(item => item.id === winner.prizeId);
      const activity = activityById.get(winner.activityId);
      return {
        id: winner.id,
        activityId: winner.activityId,
        activityTitle: activity?.title || '抽奖活动',
        prizeName: prize?.name || '奖品',
        prizeType: prize?.type || '奖品',
        resultCode: winner.resultCode || '',
        claimed: winner.claimed === true,
        claimedAt: winner.claimedAt || null,
        claimNote: winner.claimNote || '',
        createdAt: winner.createdAt,
        winner: {
          nickname: participant?.nickname || winnerMember?.nickname || '微信用户',
          phone: participant?.phone || '',
          avatar: winnerMember?.avatar || '/assets/avatar-default.svg',
          address: winnerMember?.address || null
        }
      };
    })
    .sort((left, right) => (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0));
  res.json(ok(claims));
});

app.put('/api/me/claims/:id', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const winner = db.winners.find(item => item.id === req.params.id);
    if (!winner) return { error: [404, '中奖记录不存在'] };
    const activity = db.activities.find(item => item.id === winner.activityId);
    if (!activity || !hasCreatorPermission(db, member, activity.creatorOpenid, 'claim')) {
      return { error: [403, '当前账号没有核销该奖品的权限'] };
    }
    winner.claimed = req.body?.claimed !== false;
    winner.claimedAt = winner.claimed ? nowIso() : null;
    winner.claimedBy = winner.claimed ? member.openid : '';
    winner.claimNote = String(req.body?.claimNote || '').trim().slice(0, 200);
    winner.updatedAt = nowIso();
    return winner;
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.get('/api/me/team', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  const created = db.creatorTeamMembers
    .filter(item => item.creatorOpenid === member.openid && item.status !== 'removed')
    .map(item => ({ ...item, ownedByMe: true }));
  const joined = db.creatorTeamMembers
    .filter(item => item.memberOpenid === member.openid && item.status === 'active')
    .map(item => ({
      ...item,
      ownedByMe: false,
      creatorName: db.members.find(candidate => candidate.openid === item.creatorOpenid)?.nickname || '发起人'
    }));
  res.json(ok({ created, joined }));
});

app.post('/api/me/team/invitations', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const displayName = String(req.body?.displayName || '').trim().slice(0, 30);
    const role = ['manager', 'verifier', 'viewer'].includes(req.body?.role) ? req.body.role : 'viewer';
    if (!displayName) return { error: [400, '请输入团队成员备注'] };
    let inviteCode = '';
    do {
      inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    } while (db.creatorTeamMembers.some(item => item.inviteCode === inviteCode));
    const invitation = {
      id: createId('team'),
      creatorOpenid: member.openid,
      memberOpenid: '',
      displayName,
      memberNickname: '',
      role,
      status: 'invited',
      inviteCode,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    db.creatorTeamMembers.unshift(invitation);
    return invitation;
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.post('/api/me/team/invitations/accept', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const inviteCode = String(req.body?.inviteCode || '').trim().toUpperCase();
    const invitation = db.creatorTeamMembers.find(item => item.inviteCode === inviteCode && item.status === 'invited');
    if (!invitation) return { error: [404, '团队邀请码无效'] };
    if ((Date.parse(invitation.expiresAt) || 0) <= Date.now()) return { error: [409, '团队邀请码已过期'] };
    if (invitation.creatorOpenid === member.openid) return { error: [409, '不能加入自己创建的团队'] };
    const duplicate = db.creatorTeamMembers.find(item =>
      item.creatorOpenid === invitation.creatorOpenid &&
      item.memberOpenid === member.openid &&
      item.status === 'active'
    );
    if (duplicate) return { error: [409, '你已加入该发起人团队'] };
    invitation.memberOpenid = member.openid;
    invitation.memberNickname = member.nickname || invitation.displayName;
    invitation.status = 'active';
    invitation.acceptedAt = nowIso();
    invitation.updatedAt = invitation.acceptedAt;
    return invitation;
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.patch('/api/me/team/:id', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const item = db.creatorTeamMembers.find(candidate => candidate.id === req.params.id);
    if (!item) return { error: [404, '团队成员不存在'] };
    if (item.creatorOpenid !== member.openid) return { error: [403, '只有团队创建者可以修改成员'] };
    if (['manager', 'verifier', 'viewer'].includes(req.body?.role)) item.role = req.body.role;
    if (req.body?.displayName !== undefined) {
      item.displayName = String(req.body.displayName || '').trim().slice(0, 30) || item.displayName;
    }
    item.updatedAt = nowIso();
    return item;
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.delete('/api/me/team/:id', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const item = db.creatorTeamMembers.find(candidate => candidate.id === req.params.id);
    if (!item) return { error: [404, '团队成员不存在'] };
    if (item.creatorOpenid !== member.openid && item.memberOpenid !== member.openid) {
      return { error: [403, '当前账号无权移除该成员'] };
    }
    item.status = 'removed';
    item.updatedAt = nowIso();
    return { removed: true };
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.get('/api/me/blacklist', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  const entries = db.creatorBlacklists
    .filter(item => item.creatorOpenid === member.openid && item.status !== 'removed')
    .sort((left, right) => (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0));
  const ownActivityIds = new Set(db.activities.filter(item => item.creatorOpenid === member.openid).map(item => item.id));
  const blockedOpenids = new Set(entries.map(item => item.memberOpenid));
  const candidateByOpenid = new Map();
  for (const participant of db.participants) {
    if (!ownActivityIds.has(participant.activityId) || blockedOpenids.has(participant.memberOpenid)) continue;
    if (!participant.memberOpenid || participant.memberOpenid === member.openid || candidateByOpenid.has(participant.memberOpenid)) continue;
    const activity = db.activities.find(item => item.id === participant.activityId);
    candidateByOpenid.set(participant.memberOpenid, {
      participantId: participant.id,
      nickname: participant.nickname || '微信用户',
      activityTitle: activity?.title || '抽奖活动'
    });
  }
  res.json(ok({ entries, candidates: [...candidateByOpenid.values()] }));
});

app.post('/api/me/blacklist', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const participant = db.participants.find(item => item.id === String(req.body?.participantId || ''));
    const activity = participant && db.activities.find(item => item.id === participant.activityId);
    if (!participant || !activity || activity.creatorOpenid !== member.openid) {
      return { error: [404, '只能从自己活动的参与者中添加黑名单'] };
    }
    let entry = db.creatorBlacklists.find(item =>
      item.creatorOpenid === member.openid && item.memberOpenid === participant.memberOpenid
    );
    if (!entry) {
      entry = {
        id: createId('blacklist'),
        creatorOpenid: member.openid,
        memberOpenid: participant.memberOpenid,
        nickname: participant.nickname || '微信用户',
        sourceActivityId: activity.id,
        sourceActivityTitle: activity.title,
        createdAt: nowIso()
      };
      db.creatorBlacklists.unshift(entry);
    }
    entry.reason = String(req.body?.reason || '').trim().slice(0, 120);
    entry.status = 'active';
    entry.updatedAt = nowIso();
    return entry;
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.delete('/api/me/blacklist/:id', async (req, res) => {
  const result = await withDbWrite(async db => {
    const member = sessionMember(db, req);
    if (!member) return { error: [401, '请先完成微信登录'] };
    const entry = db.creatorBlacklists.find(item => item.id === req.params.id);
    if (!entry) return { error: [404, '黑名单记录不存在'] };
    if (entry.creatorOpenid !== member.openid) return { error: [403, '当前账号无权移除该记录'] };
    entry.status = 'removed';
    entry.updatedAt = nowIso();
    return { removed: true };
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.get('/api/me/prizes', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  const participantIds = new Set(db.participants
    .filter(item => item.memberOpenid === member.openid)
    .map(item => item.id));
  const prizes = db.winners
    .filter(item => participantIds.has(item.participantId))
    .map(winner => ({
      id: winner.id,
      activityId: winner.activityId,
      activityTitle: db.activities.find(item => item.id === winner.activityId)?.title || '抽奖活动',
      prizeName: db.prizes.find(item => item.id === winner.prizeId)?.name || '奖品',
      resultCode: winner.resultCode || '',
      claimed: winner.claimed === true,
      claimedAt: winner.claimedAt || null,
      createdAt: winner.createdAt
    }))
    .sort((left, right) => (Date.parse(right.createdAt) || 0) - (Date.parse(left.createdAt) || 0));
  res.json(ok(prizes));
});

function createParticipantRecord(activity, member, body = {}, evidence = {}) {
  const palette = ['#c80f2e', '#ff7a1a', '#2f80ed', '#17a673', '#8a63d2', '#f178b6'];
  return {
    id: createId('part'),
    activityId: activity.id,
    memberOpenid: member.openid,
    nickname: String(member.nickname || '').trim(),
    phone: String(body.phone || '').trim(),
    avatarColor: palette[crypto.randomInt(0, palette.length)],
    surveyAnswers: evidence.surveyAnswers || [],
    location: evidence.location || null,
    taskCompleted: Boolean(evidence.taskCompleted),
    answerText: evidence.answerText || '',
    voteAnswer: evidence.voteAnswer || '',
    applicationId: String(body.applicationId || ''),
    attemptCount: 0,
    createdAt: nowIso()
  };
}

function runAutoDrawAfterJoin(db, activity, participant) {
  if (activity.autoDraw === true && activity.drawMode === 'instant') {
    const slots = ensureInstantWinningSlots(db, activity);
    const winners = slots.includes(Number(activity.instantAttemptCount || 0))
      ? drawWinners(db, activity, { participantIds: [participant.id], count: 1 })
      : [];
    const maxAttempts = Number(activity.instantParticipantLimit || 5) * Number(activity.instantPerUserLimit || 1);
    if (!remainingPrizes(db, activity.id).length) activity.status = 'drawn';
    if (Number(activity.instantAttemptCount || 0) >= maxAttempts && activity.status === 'live') activity.status = 'ended';
    activity.updatedAt = nowIso();
    return winners;
  }
  if (activity.autoDraw === true && activity.drawMode === 'people' &&
    db.participants.filter(item => item.activityId === activity.id).length >= Number(activity.drawParticipantTarget || 0)) {
    const winners = drawWinners(db, activity);
    activity.status = winners.length ? 'drawn' : 'ended';
    activity.updatedAt = nowIso();
    return winners;
  }
  return [];
}

app.post('/api/activities/:id/join', activityActionRateLimiter, async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  const activity = db.activities.find(item => item.id === req.params.id);
  if (!activity) return fail(res, 404, '活动不存在');
  if (activity.status !== 'live') return fail(res, 409, '活动当前不可参与');
  const drawAt = new Date(activity.drawAt).getTime();
  if (Number.isFinite(drawAt) && drawAt <= Date.now()) {
    activity.status = 'ended';
    activity.updatedAt = nowIso();
    await writeDb(db);
    return fail(res, 409, activity.drawMode === 'instant' ? '即抽即中活动已截止' : '活动已到开奖时间');
  }

  const nickname = String(member.nickname || '').trim();
  if (!nickname) return fail(res, 400, '微信用户信息无效');

  const existed = db.participants.find(item =>
    item.activityId === activity.id &&
    item.memberOpenid === member.openid
  );
  if (existed && activity.drawMode !== 'instant') {
    return res.json(ok({ participant: publicParticipant(existed), joined: false }));
  }
  if (activity.drawMode === 'instant') {
    const perUserLimit = Number(activity.instantPerUserLimit || 1);
    if (existed && Number(existed.attemptCount || 0) >= perUserLimit) {
      return fail(res, 409, `每人最多参与 ${perUserLimit} 次`);
    }
    const participantCount = db.participants.filter(item => item.activityId === activity.id).length;
    if (!existed && participantCount >= Number(activity.instantParticipantLimit || 5)) {
      return fail(res, 409, '参与人数已达到上限');
    }
  }

  const advanced = normalizeAdvanced(activity.advanced);
  let riskEvent = null;
  if (advanced.enabled && advanced.blockHighRisk) {
    const cutoff = Date.now() - 10 * 60 * 1000;
    const recentAttempts = db.riskEvents.filter(item =>
      item.memberOpenid === member.openid && new Date(item.createdAt).getTime() >= cutoff
    );
    const distinctActivities = new Set(recentAttempts.map(item => item.activityId));
    if (!distinctActivities.has(activity.id) && distinctActivities.size >= 10) {
      return fail(res, 429, '参与操作过于频繁，请稍后再试');
    }
    riskEvent = {
      id: createId('risk'),
      activityId: activity.id,
      memberOpenid: member.openid,
      outcome: 'checking',
      createdAt: nowIso()
    };
    db.riskEvents.unshift(riskEvent);
    db.riskEvents = db.riskEvents.slice(0, 5000);
  }

  let evidence;
  try {
    evidence = verifyParticipationEligibility(db, activity, member, req.body || {});
  } catch (error) {
    if (riskEvent) {
      riskEvent.outcome = 'rejected';
      riskEvent.reason = String(error.message || '').slice(0, 160);
      await writeDb(db);
    }
    return fail(res, error.status || 403, error.message);
  }
  if (riskEvent) riskEvent.outcome = 'accepted';

  if (activity.conditions?.review && !existed) {
    let application = db.participationApplications.find(item =>
      item.activityId === activity.id && item.memberOpenid === member.openid
    );
    const submittedAt = nowIso();
    if (!application) {
      application = {
        id: createId('application'),
        activityId: activity.id,
        memberOpenid: member.openid,
        nickname,
        phone: String(req.body.phone || '').trim(),
        surveyAnswers: evidence.surveyAnswers,
        location: evidence.location,
        status: 'pending',
        reviewNote: '',
        createdAt: submittedAt,
        updatedAt: submittedAt
      };
      db.participationApplications.unshift(application);
    } else if (application.status !== 'approved') {
      application.status = 'pending';
      application.phone = String(req.body.phone || application.phone || '').trim();
      application.surveyAnswers = evidence.surveyAnswers;
      application.location = evidence.location;
      application.reviewNote = '';
      application.updatedAt = submittedAt;
    }
    await writeDb(db);
    return res.json(ok({
      joined: false,
      pending: true,
      application: {
        id: application.id,
        status: application.status,
        updatedAt: application.updatedAt
      }
    }));
  }

  const participant = existed || createParticipantRecord(activity, member, req.body, evidence);
  if (!existed) db.participants.unshift(participant);
  participant.attemptCount = Math.max(0, Number(participant.attemptCount || 0)) + 1;
  if (activity.drawMode === 'instant') {
    ensureInstantWinningSlots(db, activity);
    activity.instantAttemptCount = Math.max(0, Number(activity.instantAttemptCount || 0)) + 1;
  }
  const winners = runAutoDrawAfterJoin(db, activity, participant);
  await writeDb(db);
  if (winners.length) await dispatchActivityDrawNotifications(activity.id);
  res.json(ok({
    participant: publicParticipant(participant),
    joined: !existed,
    attempted: true,
    attemptsUsed: participant.attemptCount,
    attemptsRemaining: activity.drawMode === 'instant'
      ? Math.max(0, Number(activity.instantPerUserLimit || 1) - participant.attemptCount)
      : 0,
    winners: winners.map(item => ({
      prizeName: item.prize.name,
      prizeLevel: item.prize.level
    }))
  }));
});

app.post('/api/activities/:id/assist', async (req, res) => {
  const db = await readDb();
  const member = sessionMember(db, req);
  if (!member) return fail(res, 401, '请先完成微信登录');
  const activity = db.activities.find(item => item.id === req.params.id);
  if (!activity) return fail(res, 404, '活动不存在');
  const conditions = normalizeParticipationConditions(activity.conditions);
  if (!conditions.assist) return fail(res, 409, '该活动未开启好友助力');
  if (activity.drawMode === 'instant') return fail(res, 409, '即抽即中活动不支持助力加权');
  if (activity.status !== 'live') return fail(res, 409, '活动当前不可助力');
  const targetParticipantId = String(req.body?.targetParticipantId || '').trim();
  const target = db.participants.find(item => item.id === targetParticipantId && item.activityId === activity.id);
  if (!target) return fail(res, 404, '助力对象不存在');
  if (target.memberOpenid === member.openid) return fail(res, 409, '不能为自己助力');
  const existed = db.assists.find(item => item.activityId === activity.id && item.helperOpenid === member.openid);
  if (existed) {
    const stats = assistStats(db, activity, existed.targetParticipantId);
    return res.json(ok({
      assisted: false,
      assistCount: stats.rawCount,
      effectiveAssistCount: stats.effectiveCount,
      drawWeight: stats.drawWeight,
      assistLimit: conditions.assistLimit
    }));
  }
  const currentStats = assistStats(db, activity, target.id);
  if (currentStats.rawCount >= conditions.assistLimit) {
    return fail(res, 409, '该好友已达到本场助力上限');
  }
  db.assists.unshift({
    id: createId('assist'),
    activityId: activity.id,
    targetParticipantId: target.id,
    targetMemberOpenid: target.memberOpenid,
    helperOpenid: member.openid,
    helperNickname: member.nickname,
    createdAt: nowIso()
  });
  const stats = assistStats(db, activity, target.id);
  await writeDb(db);
  res.json(ok({
    assisted: true,
    assistCount: stats.rawCount,
    effectiveAssistCount: stats.effectiveCount,
    drawWeight: stats.drawWeight,
    assistLimit: conditions.assistLimit
  }));
});

app.get('/api/admin/summary', async (req, res) => {
  const db = await readDb();
  const liveCount = db.activities.filter(item => item.status === 'live').length;
  const prizeTotal = db.prizes.reduce((sum, prize) => sum + Number(prize.quantity || 0), 0);
  const remaining = db.prizes.reduce((sum, prize) => sum + Number(prize.remaining || 0), 0);
  res.json(ok({
    activityCount: db.activities.length,
    liveCount,
    participantCount: db.participants.length,
    winnerCount: db.winners.length,
    commentCount: db.comments.length,
    pendingPartnershipCount: db.partnerships.filter(item => item.status === 'pending').length,
    prizeTotal,
    remaining
  }));
});

app.get('/api/admin/partnerships', async (req, res) => {
  const db = await readDb();
  res.json(ok([...db.partnerships].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())));
});

app.patch('/api/admin/partnerships/:id', async (req, res) => {
  const result = await withDbWrite(async db => {
    const application = db.partnerships.find(item => item.id === req.params.id);
    if (!application) return { error: [404, '合作申请不存在'] };
    const status = String(req.body?.status || '').trim();
    if (!['pending', 'contacted', 'completed', 'rejected'].includes(status)) {
      return { error: [400, '合作申请状态无效'] };
    }
    application.status = status;
    application.updatedAt = nowIso();
    return application;
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.get('/api/admin/comments', async (req, res) => {
  const db = await readDb();
  res.json(ok([...db.comments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())));
});

app.patch('/api/admin/comments/:id', async (req, res) => {
  const result = await withDbWrite(async db => {
    const comment = db.comments.find(item => item.id === req.params.id);
    if (!comment) return { error: [404, '留言不存在'] };
    const status = req.body?.status === 'hidden' ? 'hidden' : 'visible';
    comment.status = status;
    comment.updatedAt = nowIso();
    return comment;
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result));
});

app.get('/api/admin/integrations', async (req, res) => {
  const db = await readDb();
  res.json(ok({
    ...integrationCapabilities(),
    officialAccount: {
      ...integrationCapabilities().officialAccount,
      followerCount: db.officialFollowers.filter(item => item.subscribed).length,
      authorizationCount: db.officialAccountAuthorizations.filter(item => item.status === 'active').length,
      callbackPath: '/api/wechat/official-account/callback',
      openPlatform: {
        configured: wechatOpenPlatformConfigured(),
        ticketReceived: Boolean(db.wechatOpenPlatform?.componentVerifyTicket),
        ticketUpdatedAt: db.wechatOpenPlatform?.ticketUpdatedAt || '',
        componentCallbackPath: '/api/wechat/open-platform/component/callback',
        accountCallbackPath: '/api/wechat/open-platform/message/$APPID$'
      }
    },
    wecom: {
      ...integrationCapabilities().wecom,
      contactCount: db.wecomContacts.filter(item => item.corpId === wecomCorpId && item.active).length,
      groupCount: db.wecomGroups.filter(item => item.corpId === wecomCorpId).length
    }
  }));
});

app.post('/api/admin/integrations/wecom/sync', async (req, res) => {
  try {
    const result = await syncWecomContacts();
    res.json(ok({ synced: result.contacts.length, groups: result.groups.length }));
  } catch (error) {
    fail(res, 502, error.message || '企业微信联系人同步失败');
  }
});

app.get('/api/admin/withdrawals', async (req, res) => {
  const db = await readDb();
  const members = new Map(db.members.map(item => [item.openid, item]));
  const records = db.wallet.records
    .filter(item => item.type === 'withdrawal')
    .map(item => ({
      ...item,
      memberNickname: members.get(item.memberOpenid)?.nickname || '微信用户'
    }));
  res.json(ok(records));
});

app.patch('/api/admin/withdrawals/:id', async (req, res) => {
  const result = await withDbWrite(async db => {
    const record = db.wallet.records.find(item => item.id === req.params.id && item.type === 'withdrawal');
    if (!record) return { error: [404, '提现申请不存在'] };
    if (record.status !== 'pending') return { error: [409, '提现申请已处理'] };
    const status = String(req.body?.status || '');
    if (!['paid', 'rejected'].includes(status)) return { error: [400, '处理状态无效'] };
    record.status = status;
    record.updatedAt = nowIso();
    if (status === 'rejected') {
      db.wallet.records.unshift({
        id: createId('wallet'),
        memberOpenid: record.memberOpenid,
        title: '提现退回',
        type: 'withdrawal_refund',
        amount: Math.abs(Number(record.amount || 0)),
        status: 'completed',
        relatedRecordId: record.id,
        createdAt: nowIso()
      });
    }
    return { record };
  });
  if (result.error) return fail(res, result.error[0], result.error[1]);
  res.json(ok(result.record));
});

app.get('/api/admin/activities', async (req, res) => {
  const db = await readDb();
  const members = new Map(db.members.map(item => [item.openid, item]));
  const bundles = db.activities.map(activity => {
    const bundle = getActivityBundle(db, activity.id);
    return {
      ...bundle,
      taskReviews: bundle.activityTasks.map(record => ({
        ...record,
        memberNickname: members.get(record.memberOpenid)?.nickname || '微信用户',
        memberAvatarColor: members.get(record.memberOpenid)?.avatarColor || '#d90f34'
      }))
    };
  });
  res.json(ok(bundles));
});

app.post('/api/admin/activities', async (req, res) => {
  const db = await readDb();
  const data = normalizeActivityInput({
    ...(req.body || {}),
    autoDraw: req.body?.autoDraw !== false
  }, `新抽奖活动 ${db.activities.length + 1}`);
  if (!data.title) return fail(res, 400, '活动名称不能为空');
  const activity = {
    id: createId('act'),
    ...data,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  db.activities.unshift(activity);
  await writeDb(db);
  res.json(ok(activity));
});

app.put('/api/admin/activities/:id', async (req, res) => {
  const db = await readDb();
  const activity = db.activities.find(item => item.id === req.params.id);
  if (!activity) return fail(res, 404, '活动不存在');
  const normalized = normalizeActivityInput({ ...activity, ...req.body }, activity.title);
  if (!normalized.title) return fail(res, 400, '活动名称不能为空');
  if (normalized.drawMode === 'people' && normalized.drawParticipantTarget < 1) {
    return fail(res, 400, '请设置按人数开奖的目标人数');
  }
  const prizeCount = db.prizes
    .filter(item => item.activityId === activity.id)
    .reduce((sum, prize) => sum + Number(prize.quantity || 0), 0);
  if (normalized.drawMode === 'people' && normalized.drawParticipantTarget < prizeCount) {
    return fail(res, 400, '按人数开奖的目标人数不能少于奖品总份数');
  }
  if (normalized.drawMode === 'instant' && normalized.conditions.assist) {
    return fail(res, 400, '即抽即中不支持助力加权');
  }
  const preserved = {
    id: activity.id,
    creator: activity.creator,
    creatorOpenid: activity.creatorOpenid,
    instantWinningSlots: activity.instantWinningSlots,
    createdAt: activity.createdAt
  };
  Object.assign(activity, normalized, preserved, { updatedAt: nowIso() });
  await writeDb(db);
  res.json(ok(activity));
});

app.post('/api/admin/activities/:id/status', async (req, res) => {
  const db = await readDb();
  const activity = db.activities.find(item => item.id === req.params.id);
  if (!activity) return fail(res, 404, '活动不存在');
  const allowed = ['draft', 'live', 'drawn', 'ended'];
  const status = String(req.body.status || '');
  if (!allowed.includes(status)) return fail(res, 400, '状态无效');
  if (status === 'live' && new Date(activity.drawAt).getTime() <= Date.now()) {
    return fail(res, 400, '开奖时间已过，请先设置未来的开奖时间');
  }
  activity.status = status;
  activity.updatedAt = nowIso();
  await writeDb(db);
  res.json(ok(activity));
});

app.post('/api/admin/activities/:id/prizes', async (req, res) => {
  const db = await readDb();
  const activity = db.activities.find(item => item.id === req.params.id);
  if (!activity) return fail(res, 404, '活动不存在');
  const quantity = Math.max(1, Number(req.body.quantity || 1));
  const type = String(req.body.type || req.body.level || '奖品').trim();
  const faceValue = Math.max(0, Math.min(100000, Math.round(Number(req.body.faceValue || 0) * 100) / 100));
  if (['红包', '优惠券'].includes(type) && faceValue <= 0) {
    return fail(res, 400, '请填写红包或优惠券的有效面额');
  }
  const prize = {
    id: createId('prize'),
    activityId: activity.id,
    name: String(req.body.name || '').trim() || '活动奖品',
    level: String(req.body.level || '').trim() || '奖项',
    quantity,
    remaining: quantity,
    image: String(req.body.image || '/assets/prize-redpack.svg'),
    type,
    faceValue,
    deliveryMethod: String(req.body.deliveryMethod || '发起人发货').trim(),
    sort: Number(req.body.sort || db.prizes.filter(item => item.activityId === activity.id).length + 1)
  };
  db.prizes.push(prize);
  await writeDb(db);
  res.json(ok(prize));
});

app.get('/api/admin/participants', async (req, res) => {
  const db = await readDb();
  const activityId = String(req.query.activityId || '');
  const rows = db.participants
    .filter(item => !activityId || item.activityId === activityId)
    .map(item => ({
      ...item,
      activityTitle: db.activities.find(activity => activity.id === item.activityId)?.title || ''
    }));
  res.json(ok(rows));
});

app.post('/api/admin/participation-applications/:id/review', async (req, res) => {
  const db = await readDb();
  const application = db.participationApplications.find(item => item.id === req.params.id);
  if (!application) return fail(res, 404, '审核申请不存在');
  const status = String(req.body?.status || '');
  if (!['approved', 'rejected'].includes(status)) return fail(res, 400, '审核状态无效');
  if (application.status === 'approved' && status === 'rejected') {
    return fail(res, 409, '已进入抽奖池的申请不能再拒绝');
  }
  if (application.status === 'approved' && status === 'approved') {
    const participant = db.participants.find(item => item.applicationId === application.id) || null;
    return res.json(ok({ application, participant, winners: [] }));
  }
  const activity = db.activities.find(item => item.id === application.activityId);
  const member = db.members.find(item => item.openid === application.memberOpenid);
  if (!activity || !member) return fail(res, 409, '活动或申请用户数据不完整');
  if (status === 'approved' && activity.status !== 'live') {
    return fail(res, 409, '活动当前不可参与');
  }
  if (status === 'approved' && activity.drawMode === 'instant') {
    const drawAt = new Date(activity.drawAt).getTime();
    if (Number.isFinite(drawAt) && drawAt <= Date.now()) return fail(res, 409, '即抽即中活动已截止');
    const existed = db.participants.some(item =>
      item.activityId === activity.id && item.memberOpenid === member.openid
    );
    const participantCount = db.participants.filter(item => item.activityId === activity.id).length;
    if (!existed && participantCount >= Number(activity.instantParticipantLimit || 5)) {
      return fail(res, 409, '参与人数已达到上限');
    }
  }

  application.status = status;
  application.reviewNote = String(req.body?.reviewNote || '').trim().slice(0, 200);
  application.reviewedAt = nowIso();
  application.updatedAt = application.reviewedAt;
  let participant = null;
  let winners = [];
  if (status === 'approved') {
    participant = db.participants.find(item =>
      item.activityId === activity.id && item.memberOpenid === member.openid
    );
    if (!participant) {
      participant = createParticipantRecord(activity, member, {
        phone: application.phone,
        applicationId: application.id
      }, {
        surveyAnswers: application.surveyAnswers,
        location: application.location
      });
      db.participants.unshift(participant);
      participant.attemptCount = 1;
      if (activity.drawMode === 'instant') {
        ensureInstantWinningSlots(db, activity);
        activity.instantAttemptCount = Math.max(0, Number(activity.instantAttemptCount || 0)) + 1;
      }
      winners = runAutoDrawAfterJoin(db, activity, participant);
    }
  }
  await writeDb(db);
  if (winners.length) await dispatchActivityDrawNotifications(activity.id);
  res.json(ok({ application, participant, winners }));
});

app.post('/api/admin/activity-tasks/:id/review', async (req, res) => {
  const db = await readDb();
  const task = db.activityTasks.find(item => item.id === req.params.id);
  if (!task) return fail(res, 404, '任务凭证不存在');
  const status = String(req.body?.status || '');
  if (!['approved', 'rejected'].includes(status)) return fail(res, 400, '审核状态无效');
  if (task.status !== 'pending') return fail(res, 409, '该任务当前不在待审核状态');
  const reviewedAt = nowIso();
  task.status = status === 'approved' ? 'completed' : 'rejected';
  task.reviewNote = String(req.body?.reviewNote || '').trim().slice(0, 200);
  task.reviewedAt = reviewedAt;
  task.updatedAt = reviewedAt;
  if (task.status === 'completed') task.completedAt = reviewedAt;
  await writeDb(db);
  res.json(ok(taskProgressPayload(task)));
});

app.get('/api/admin/activity-tasks/:id/proof', async (req, res) => {
  const db = await readDb();
  const task = db.activityTasks.find(item => item.id === req.params.id);
  const filename = String(task?.proofFilename || '');
  if (!task || !/^task_proof_[a-z0-9_]+\.(?:jpg|png|webp)$/i.test(filename)) {
    return fail(res, 404, '任务凭证不存在');
  }
  const filePath = path.join(taskProofDir, filename);
  try {
    await fs.access(filePath);
    res.type(task.proofMimeType || 'image/jpeg').sendFile(filePath);
  } catch {
    fail(res, 404, '任务凭证文件不存在');
  }
});

app.get('/api/admin/winners', async (req, res) => {
  const db = await readDb();
  const activityId = String(req.query.activityId || '');
  const rows = db.winners
    .filter(item => !activityId || item.activityId === activityId)
    .map(item => ({
      ...item,
      activityTitle: db.activities.find(activity => activity.id === item.activityId)?.title || '',
      prize: db.prizes.find(prize => prize.id === item.prizeId),
      participant: db.participants.find(participant => participant.id === item.participantId)
    }));
  res.json(ok(rows));
});

app.put('/api/admin/winners/:id/claim', async (req, res) => {
  const db = await readDb();
  const winner = db.winners.find(item => item.id === req.params.id);
  if (!winner) return fail(res, 404, '中奖记录不存在');
  winner.claimed = Boolean(req.body.claimed);
  winner.claimedAt = winner.claimed ? nowIso() : null;
  await writeDb(db);
  res.json(ok(winner));
});

app.post('/api/admin/activities/:id/draw', async (req, res) => {
  const db = await readDb();
  const activity = db.activities.find(item => item.id === req.params.id);
  if (!activity) return fail(res, 404, '活动不存在');
  const created = drawWinners(db, activity, {
    prizeId: req.body.prizeId,
    count: Math.max(1, Number(req.body.count || 1))
  });
  if (!created.length) return fail(res, 409, '开奖未产生新记录');
  await writeDb(db);
  await dispatchActivityDrawNotifications(activity.id);
  res.json(ok(created));
});

await ensureDb();
processDueDraws().catch(error => console.error('Initial due-draw check failed:', error.message));
setInterval(() => {
  processDueDraws().catch(error => console.error('Scheduled due-draw check failed:', error.message));
}, drawSchedulerIntervalMs).unref();
app.listen(port, host, () => {
  const baseUrl = host === '0.0.0.0' ? `http://localhost:${port}` : `http://${host}:${port}`;
  console.log(`Lottery Tool running at ${baseUrl}`);
  console.log(`Mini program entry: ${baseUrl}/mini`);
  console.log(`Admin panel:  ${baseUrl}/admin`);
});
