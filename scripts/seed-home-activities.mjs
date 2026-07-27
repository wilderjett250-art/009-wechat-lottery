const baseUrl = String(process.env.LOTTERY_BASE_URL || 'https://lottery.example.com').replace(/\/$/, '');
const adminToken = String(process.env.ADMIN_TOKEN || '').trim();

if (!adminToken) {
  throw new Error('ADMIN_TOKEN is required');
}

const day = 24 * 60 * 60 * 1000;
const shanghaiOffset = 8 * 60 * 60 * 1000;
const now = new Date();

function drawAt(days, hour = 20) {
  const dateKey = new Date(now.getTime() + shanghaiOffset + days * day).toISOString().slice(0, 10);
  return new Date(`${dateKey}T${String(hour).padStart(2, '0')}:00:00+08:00`).toISOString();
}

const activities = [
  {
    title: '100份鹰嘴豆坚果能量礼包',
    subtitle: '官方大奖',
    coverText: '100份健康能量礼包，参与后等待统一开奖',
    image: '/assets/hero-oats-photo.jpg',
    homePlacement: 'official',
    homePriority: 980,
    drawAt: drawAt(7),
    promotion: { platformRecommend: true },
    prize: { name: '鹰嘴豆坚果能量礼包', level: '官方大奖', quantity: 100, image: '/assets/hero-oats-photo.jpg' }
  },
  {
    title: '无线蓝牙耳机 10份',
    subtitle: '官方大奖',
    coverText: '轻巧便携的无线蓝牙耳机',
    image: '/assets/cover-airpods.svg',
    homePlacement: 'official',
    homePriority: 960,
    drawAt: drawAt(10),
    promotion: { platformRecommend: true },
    prize: { name: '无线蓝牙耳机', level: '官方大奖', quantity: 10, image: '/assets/cover-airpods.svg' }
  },
  {
    title: '66.6元现金红包',
    subtitle: '天天送现金',
    coverText: '66.6元现金红包，开奖后按活动规则发放',
    image: '/assets/cash-666.svg',
    homePlacement: 'cash',
    homePriority: 900,
    drawAt: drawAt(1),
    prize: { name: '66.6元现金红包', level: '现金红包', quantity: 30, image: '/assets/prize-redpack.svg', type: '红包', faceValue: 66.6, deliveryMethod: '中奖后由发起方发放' }
  },
  {
    title: '18.8元现金红包',
    subtitle: '天天送现金',
    coverText: '18.8元现金红包，开奖后按活动规则发放',
    image: '/assets/prize-redpack.svg',
    homePlacement: 'cash',
    homePriority: 880,
    drawAt: drawAt(2),
    prize: { name: '18.8元现金红包', level: '现金红包', quantity: 80, image: '/assets/prize-redpack.svg', type: '红包', faceValue: 18.8, deliveryMethod: '中奖后由发起方发放' }
  },
  {
    title: '8.8元现金红包',
    subtitle: '天天送现金',
    coverText: '8.8元现金红包，开奖后按活动规则发放',
    image: '/assets/prize-redpack.svg',
    homePlacement: 'cash',
    homePriority: 860,
    drawAt: drawAt(3),
    prize: { name: '8.8元现金红包', level: '现金红包', quantity: 200, image: '/assets/prize-redpack.svg', type: '红包', faceValue: 8.8, deliveryMethod: '中奖后由发起方发放' }
  },
  {
    title: '旅行保温杯套装',
    subtitle: '今日奖品',
    coverText: '轻便随行，适合通勤和旅行',
    image: '/assets/cover-coffee.svg',
    homePlacement: 'daily',
    homePriority: 780,
    drawAt: drawAt(4),
    prize: { name: '旅行保温杯套装', level: '今日奖品', quantity: 20, image: '/assets/cover-coffee.svg' }
  },
  {
    title: '智能拍立得相机',
    subtitle: '今日奖品',
    coverText: '记录日常精彩瞬间',
    image: '/assets/cover-camera.svg',
    homePlacement: 'daily',
    homePriority: 760,
    drawAt: drawAt(5),
    prize: { name: '智能拍立得相机', level: '今日奖品', quantity: 8, image: '/assets/cover-camera.svg' }
  },
  {
    title: '便携无线耳机',
    subtitle: '今日奖品',
    coverText: '轻巧便携，随时享受音乐',
    image: '/assets/cover-airpods.svg',
    homePlacement: 'daily',
    homePriority: 740,
    drawAt: drawAt(6),
    prize: { name: '便携无线耳机', level: '今日奖品', quantity: 15, image: '/assets/cover-airpods.svg' }
  },
  {
    title: '趣味毛绒玩具',
    subtitle: '今日奖品',
    coverText: '柔软舒适的趣味毛绒玩具',
    image: '/assets/cover-toy.svg',
    homePlacement: 'daily',
    homePriority: 720,
    drawAt: drawAt(8),
    prize: { name: '趣味毛绒玩具', level: '今日奖品', quantity: 30, image: '/assets/cover-toy.svg' }
  }
];

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.code !== 0) {
    throw new Error(`${options.method || 'GET'} ${path}: ${payload.msg || response.statusText}`);
  }
  return payload.data;
}

async function ensureActivity(definition, existingActivities) {
  let activity = existingActivities.find(item =>
    item.title === definition.title &&
    item.homePlacement === definition.homePlacement &&
    item.status === 'live' &&
    new Date(item.drawAt).getTime() > Date.now()
  );

  if (!activity) {
    activity = await api('/api/admin/activities', {
      method: 'POST',
      body: JSON.stringify({
        title: definition.title,
        subtitle: definition.subtitle,
        coverText: definition.coverText,
        description: `${definition.coverText}。用户登录后可真实参与，系统按设定时间开奖。`,
        organizer: '抽奖助手官方',
        organizerVerified: true,
        image: definition.image,
        sponsorText: '首页运营活动',
        status: 'draft',
        startAt: now.toISOString(),
        endAt: definition.drawAt,
        drawAt: definition.drawAt,
        drawMode: 'time',
        autoDraw: true,
        templateType: '新样式',
        homePlacement: definition.homePlacement,
        homePriority: definition.homePriority,
        promotion: definition.promotion || {},
        advanced: { enabled: false },
        conditions: {},
        rule: '每个微信用户限参与一次，到达开奖时间后由系统随机开奖。',
        shareTitle: definition.title
      })
    });
    console.log(`created activity: ${activity.title}`);
  } else {
    const refreshed = await api(`/api/admin/activities/${activity.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: definition.title,
        subtitle: definition.subtitle,
        coverText: definition.coverText,
        description: `${definition.coverText}。用户登录后可真实参与，系统按设定时间开奖。`,
        organizer: '抽奖助手官方',
        organizerVerified: true,
        image: definition.image,
        sponsorText: '首页运营活动',
        startAt: now.toISOString(),
        endAt: definition.drawAt,
        drawAt: definition.drawAt,
        rule: '每个微信用户限参与一次，到达开奖时间后由系统随机开奖。',
        shareTitle: definition.title
      })
    });
    activity = { ...activity, ...refreshed };
    console.log(`refreshed activity: ${activity.title}`);
  }

  if (!Array.isArray(activity.prizes) || activity.prizes.length === 0) {
    await api(`/api/admin/activities/${activity.id}/prizes`, {
      method: 'POST',
      body: JSON.stringify({
        type: '奖品',
        deliveryMethod: '发起方发货',
        sort: 1,
        ...definition.prize
      })
    });
    console.log(`created prize: ${definition.prize.name}`);
  }

  if (activity.status !== 'live') {
    await api(`/api/admin/activities/${activity.id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: 'live' })
    });
    console.log(`published activity: ${activity.title}`);
  }
}

const existingActivities = await api('/api/admin/activities');
for (const definition of activities) {
  await ensureActivity(definition, existingActivities);
}

const home = await api('/api/home');
console.log(JSON.stringify({
  official: home.official.map(item => item.title),
  cash: home.cash.map(item => item.title),
  today: home.today.map(item => item.title)
}, null, 2));
