const STORAGE_KEY = 'lotteryLocalDbV1';

function initialDb() {
  return {
    activities: [
      {
        id: 'act_1001',
        title: '100 包桂格燕麦片',
        subtitle: '官方大奖',
        coverText: '100 包桂格燕麦片 x 1 份',
        description: '点击参与抽奖，每位用户限参与一次，到点后自动开奖。',
        organizer: '抽奖工具',
        organizerVerified: true,
        image: '/assets/hero-oats-photo.jpg',
        sponsorText: '中奖后请及时填写兑奖信息，奖品按活动规则发放。',
        status: 'live',
        drawAt: '2026-07-09T04:00:00.000Z',
        prizeName: '100 包桂格燕麦片',
        prizeQuantity: 1,
        participants: ['不止树', '一川生', '真真', '小影', 'Lucky']
      },
      {
        id: 'act_1002',
        title: '放青松 不焦绿',
        subtitle: '熊猫治愈系摆件',
        coverText: '治愈摆件套装 x 3 份',
        description: '适合社群福利和粉丝互动的治愈系礼物。',
        organizer: '抽奖工具',
        organizerVerified: true,
        image: '/assets/cover-panda.svg',
        sponsorText: '开奖后按页面提示提交收货信息。',
        status: 'live',
        drawAt: '2026-07-10T04:00:00.000Z',
        prizeName: '熊猫治愈系摆件',
        prizeQuantity: 3,
        participants: ['阿发']
      },
      {
        id: 'act_1003',
        title: '皮克斯玩具总动员手办',
        subtitle: '潮玩收藏',
        coverText: '经典潮玩手办 x 2 份',
        description: '收藏向潮玩福利，关注后即可参与。',
        organizer: '抽奖工具',
        organizerVerified: true,
        image: '/assets/cover-toy.svg',
        sponsorText: '请在开奖后及时确认兑奖信息。',
        status: 'live',
        drawAt: '2026-07-11T04:00:00.000Z',
        prizeName: '潮玩手办',
        prizeQuantity: 2,
        participants: ['Cindy']
      },
      {
        id: 'act_1004',
        title: '大疆 POCKET 3',
        subtitle: '口袋影像装备',
        coverText: '影像创作套装 x 1 份',
        description: '适合视频号和直播间的高价值互动福利。',
        organizer: '影像玩家社',
        organizerVerified: true,
        image: '/assets/cover-camera.svg',
        sponsorText: '活动由影像玩家社发起。',
        status: 'live',
        drawAt: '2026-07-12T04:00:00.000Z',
        prizeName: '影像创作套装',
        prizeQuantity: 1,
        participants: []
      }
    ],
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
    coupons: [],
    orders: []
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function normalizeMemberData(db) {
  let changed = false;
  if (isLegacyDemoMemberData(db)) {
    db.memberStats = { total: 0, created: 0, won: 0 };
    db.wallet = { balance: 0, frozen: 0, records: [] };
    db.coupons = [];
    db.orders = [];
    changed = true;
  }
  if (!db.memberStats || typeof db.memberStats !== 'object') {
    db.memberStats = { total: 0, created: 0, won: 0 };
    changed = true;
  }
  if (!db.wallet || typeof db.wallet !== 'object') {
    db.wallet = { balance: 0, frozen: 0, records: [] };
    changed = true;
  }
  if (!Array.isArray(db.wallet.records)) {
    db.wallet.records = [];
    changed = true;
  }
  if (!Array.isArray(db.coupons)) {
    db.coupons = [];
    changed = true;
  }
  if (!Array.isArray(db.orders)) {
    db.orders = [];
    changed = true;
  }
  return changed;
}

function getDb() {
  const saved = wx.getStorageSync(STORAGE_KEY);
  if (saved && saved.activities) {
    if (normalizeMemberData(saved)) saveDb(saved);
    return saved;
  }
  const db = initialDb();
  wx.setStorageSync(STORAGE_KEY, db);
  return db;
}

function saveDb(db) {
  wx.setStorageSync(STORAGE_KEY, db);
}

function getLocalSession() {
  try {
    return wx.getStorageSync('lotteryToken') || '';
  } catch (error) {
    return '';
  }
}

function getLocalProfile() {
  try {
    return wx.getStorageSync('lotteryLocalProfile') || wx.getStorageSync('lotteryProfile') || null;
  } catch (error) {
    return null;
  }
}

function enrichActivity(activity) {
  const participants = (activity.participants || []).map((nickname, index) => ({
    id: `${activity.id}_participant_${index + 1}`,
    activityId: activity.id,
    nickname,
    createdAt: new Date().toISOString()
  }));
  const localPrizes = Array.isArray(activity.prizes) && activity.prizes.length
    ? activity.prizes
    : [{
        name: activity.prizeName || activity.title,
        level: activity.subtitle || '幸运奖',
        quantity: Number(activity.prizeQuantity || 1),
        image: activity.image,
        type: '奖品',
        faceValue: 0,
        deliveryMethod: '发起人发货'
      }];
  const prizes = localPrizes.map((prize, index) => ({
    id: prize.id || `${activity.id}_prize_${index + 1}`,
    activityId: activity.id,
    name: prize.name,
    level: prize.level || prize.type || '奖品',
    type: prize.type || prize.level || '奖品',
    faceValue: Number(prize.faceValue || 0),
    quantity: Number(prize.quantity || 1),
    remaining: Number(prize.remaining ?? prize.quantity ?? 1),
    image: prize.image || activity.image,
    deliveryMethod: prize.deliveryMethod || '发起人发货',
    sort: index + 1
  }));
  return {
    ...activity,
    prizes,
    participants,
    winners: [],
    metrics: {
      participantCount: participants.length,
      winnerCount: 0,
      prizeCount: prizes.reduce((sum, prize) => sum + prize.quantity, 0),
      remainingPrizeCount: prizes.reduce((sum, prize) => sum + prize.remaining, 0)
    }
  };
}

function createActivity(db, data = {}) {
  const inputPrizes = Array.isArray(data.prizes) && data.prizes.length
    ? data.prizes
    : [{
        name: data.prizeName,
        quantity: data.prizeQuantity,
        type: data.prizeType,
        image: data.image,
        deliveryMethod: data.deliveryMethod,
        faceValue: data.faceValue
      }];
  const prizes = inputPrizes.map((item, index) => ({
    id: `local_prize_${Date.now()}_${index}`,
    name: String(item.name || '').trim(),
    level: String(item.type || item.level || '奖品').trim(),
    type: String(item.type || item.level || '奖品').trim(),
    faceValue: Math.max(0, Number(item.faceValue || 0)),
    quantity: Math.max(1, Number(item.quantity || 1)),
    image: item.image || '/assets/lottery-ribbon.svg',
    deliveryMethod: item.deliveryMethod || '发起人发货'
  }));
  const firstPrize = prizes[0];
  const prizeName = firstPrize.name;
  const quantity = firstPrize.quantity;
  const profile = getLocalProfile();
  const activity = {
    id: `local_${Date.now()}`,
    title: prizeName,
    subtitle: data.prizeType || '普通抽奖',
    coverText: `${prizeName} x ${quantity} 份`,
    description: String(data.description || '抽奖活动已创建，欢迎参与。').trim(),
    organizer: profile?.nickname || '抽奖工具',
    organizerVerified: true,
    image: firstPrize.image,
    sponsorText: '中奖后请及时联系发起方兑奖。',
    status: data.status || 'live',
    drawAt: data.drawAt || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    prizeName,
    prizeQuantity: quantity,
    prizes,
    leadInfo: String(data.leadInfo || '').trim(),
    introImages: Array.isArray(data.introImages) ? data.introImages : [],
    participants: []
  };
  db.activities.unshift(activity);
  db.memberStats = db.memberStats || { total: 0, created: 0, won: 0 };
  db.memberStats.created = Number(db.memberStats.created || 0) + 1;
  db.memberStats.total = Number(db.memberStats.total || 0) + 1;
  db.memberStats.won = Number(db.memberStats.won || 0);
  saveDb(db);
  return enrichActivity(activity);
}

function localRequest(path, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const db = getDb();

  if (path === '/api/activities' && method === 'GET') {
    return Promise.resolve(clone(db.activities.map(enrichActivity)));
  }

  if (path === '/api/activities' && method === 'POST') {
    return Promise.resolve(clone(createActivity(db, options.data || {})));
  }

  if (path === '/api/uploads/image' && method === 'POST') {
    const mimeType = String(options.data?.mimeType || 'image/jpeg');
    const base64 = String(options.data?.base64 || '');
    if (!base64) return Promise.reject(new Error('图片数据无效'));
    return Promise.resolve({ url: `data:${mimeType};base64,${base64}` });
  }

  const detailMatch = path.match(/^\/api\/activities\/([^/]+)$/);
  if (detailMatch && method === 'GET') {
    const activity = db.activities.find(item => item.id === detailMatch[1]);
    if (!activity) return Promise.reject(new Error('活动不存在'));
    return Promise.resolve(clone(enrichActivity(activity)));
  }

  const joinMatch = path.match(/^\/api\/activities\/([^/]+)\/join$/);
  if (joinMatch && method === 'POST') {
    const activity = db.activities.find(item => item.id === joinMatch[1]);
    if (!activity) return Promise.reject(new Error('活动不存在'));
    const nickname = String(options.data?.nickname || '微信用户').trim();
    activity.participants = activity.participants || [];
    if (!activity.participants.includes(nickname)) activity.participants.push(nickname);
    saveDb(db);
    return Promise.resolve({ joined: true });
  }

  if (path === '/api/me/overview') {
    const profile = getLocalSession() ? getLocalProfile() : null;
    return Promise.resolve(clone({
      authenticated: Boolean(profile),
      profile,
      stats: db.memberStats,
      wallet: db.wallet,
      couponCount: db.coupons.length,
      orderCount: db.orders.length
    }));
  }

  if (path === '/api/me/wallet') return Promise.resolve(clone(db.wallet));
  if (path === '/api/me/withdrawals' && method === 'POST') {
    const amount = Number(options.data?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) return Promise.reject(new Error('请输入有效的提现金额'));
    if (amount > Number(db.wallet.balance || 0)) return Promise.reject(new Error('可提现余额不足'));
    const record = {
      id: `local_wallet_${Date.now()}`,
      title: '余额提现',
      type: 'withdrawal',
      amount: -amount,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    db.wallet.balance = Number(db.wallet.balance || 0) - amount;
    db.wallet.frozen = Number(db.wallet.frozen || 0) + amount;
    db.wallet.records.unshift(record);
    saveDb(db);
    return Promise.resolve({ record, wallet: clone(db.wallet) });
  }
  if (path === '/api/me/coupons') return Promise.resolve(clone(db.coupons));
  if (path === '/api/me/orders') return Promise.resolve(clone(db.orders));
  if (path === '/api/me/messages') return Promise.resolve([]);
  if (path === '/api/me/address' && method === 'GET') {
    return Promise.resolve(clone(db.address || null));
  }
  if (path === '/api/me/address' && method === 'PUT') {
    db.address = clone(options.data || {});
    saveDb(db);
    return Promise.resolve(clone(db.address));
  }

  if (path === '/api/auth/wechat-login' && method === 'POST') {
    const nickname = String(options.data?.nickname || '微信用户').trim();
    const profile = {
      nickname,
      level: 1,
      avatar: '/assets/avatar-default.svg'
    };
    wx.setStorageSync('lotteryLocalProfile', profile);
    return Promise.resolve({
      openid: 'local_openid',
      unionid: '',
      sessionId: 'local_session',
      profile
    });
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    wx.removeStorageSync('lotteryLocalProfile');
    return Promise.resolve({ loggedOut: true });
  }

  return Promise.reject(new Error('接口未接入'));
}

module.exports = { localRequest };
