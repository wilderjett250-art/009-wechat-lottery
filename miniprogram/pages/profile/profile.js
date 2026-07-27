const { request, assetUrl, uploadFile } = require('../../utils/request');
const { FALLBACK_METRICS, applyNavigationMetrics } = require('../../utils/navigation');
const { requirePrivacyAuthorization } = require('../../utils/privacy');

const CREATOR_FEATURES = [
  { key: 'activities', label: '活动管理', icon: '活', countKey: 'activityCount' },
  { key: 'claims', label: '中奖核销', icon: '核', countKey: 'pendingClaimCount' },
  { key: 'team', label: '团队管理', icon: '团', countKey: 'teamCount' },
  { key: 'drafts', label: '草稿箱', icon: '稿', countKey: 'draftCount' },
  { key: 'personal', label: '发起人信息', icon: '人' },
  { key: 'authorization', label: '授权管理', icon: '授', countKey: 'authorizationCount' },
  { key: 'blacklist', label: '黑名单管理', icon: '禁', countKey: 'blacklistCount' },
  { key: 'wallet', label: '资金管理', icon: '资' },
  { key: 'creatorHome', label: '抽奖主页', icon: '页' },
  { key: 'growth', label: '成长中心', icon: '长' },
  { key: 'smartPromotion', label: '智能推广', icon: '推' },
  { key: 'partnership', label: '专属顾问', icon: '顾' }
];

const COMMON_FEATURES = [
  { key: 'messages', label: '消息', icon: '信' },
  { key: 'partnership', label: '推广合作', icon: '合' },
  { key: 'settings', label: '设置', icon: '设' },
  { key: 'help', label: '常见问题', icon: '问' }
];

function mimeTypeFromPath(filePath = '') {
  const extension = String(filePath).split('.').pop().toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function readFileBase64(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: result => resolve(result.data),
      fail: error => reject(new Error(error.errMsg || '头像读取失败'))
    });
  });
}

function resolveImagePath(source) {
  if (typeof wx.getImageInfo !== 'function') return Promise.resolve(source);
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: source,
      success: result => resolve(result.path || source),
      fail: error => reject(new Error(error.errMsg || '头像解析失败'))
    });
  });
}

async function prepareAvatarUpload(source) {
  try {
    return {
      base64: await readFileBase64(source),
      mimeType: mimeTypeFromPath(source)
    };
  } catch (initialError) {
    const resolvedPath = await resolveImagePath(source);
    if (!resolvedPath || resolvedPath === source) throw initialError;
    return {
      base64: await readFileBase64(resolvedPath),
      mimeType: mimeTypeFromPath(resolvedPath)
    };
  }
}

function buildCreatorFeatures(counts = {}) {
  return CREATOR_FEATURES.map(item => ({
    ...item,
    badge: item.countKey ? Number(counts[item.countKey] || 0) : 0
  }));
}

Page({
  data: {
    navMetrics: FALLBACK_METRICS,
    authenticated: false,
    rawAvatar: '/assets/avatar-default.svg',
    profile: {
      nickname: '点击微信登录',
      level: 0,
      avatarImage: assetUrl('/assets/avatar-default.svg')
    },
    stats: { total: 0, created: 0, won: 0 },
    wallet: { balance: '0.00', frozen: 0 },
    couponCount: 0,
    orderCount: 0,
    creator: {
      activityCount: 0,
      liveCount: 0,
      draftCount: 0,
      pendingClaimCount: 0,
      teamCount: 0,
      blacklistCount: 0,
      authorizationCount: 0,
      prizeCount: 0
    },
    creatorFeatures: buildCreatorFeatures(),
    commonFeatures: COMMON_FEATURES,
    profileEditor: {
      visible: false,
      nickname: '',
      avatarPath: '',
      avatarPreview: assetUrl('/assets/avatar-default.svg')
    },
    avatarPreparing: false,
    savingProfile: false
  },
  onLoad() {
    applyNavigationMetrics(this);
  },
  onShow() {
    wx.showTabBar();
    this.loadOverview();
  },
  async loadOverview(options = {}) {
    try {
      const overview = await request('/api/me/overview');
      this.applyOverview(overview);
      return overview;
    } catch (error) {
      if (!options.quiet) wx.showToast({ title: error.message || '个人数据加载失败', icon: 'none' });
      return null;
    }
  },
  applyOverview(overview = {}) {
    const authenticated = Boolean(
      overview.authenticated &&
      overview.profile &&
      overview.profile.profileCompleted === true
    );
    const profile = overview.profile || {};
    const wallet = overview.wallet || {};
    const creator = { ...this.data.creator, ...(overview.creator || {}) };
    const rawAvatar = authenticated ? (profile.avatar || '/assets/avatar-default.svg') : '/assets/avatar-default.svg';
    this.setData({
      authenticated,
      rawAvatar,
      profile: {
        nickname: authenticated ? (profile.nickname || '微信用户') : '点击微信登录',
        level: authenticated ? Number(profile.level || 1) : 0,
        avatarImage: assetUrl(rawAvatar)
      },
      stats: {
        total: Number(overview.stats?.total || 0),
        created: Number(overview.stats?.created || 0),
        won: Number(overview.stats?.won || 0)
      },
      wallet: {
        balance: Number(wallet.balance || 0).toFixed(2),
        frozen: Number(wallet.frozen || 0)
      },
      couponCount: Number(overview.couponCount || 0),
      orderCount: Number(overview.orderCount || 0),
      creator,
      creatorFeatures: buildCreatorFeatures(creator)
    });
  },
  login() {
    this.pendingAvatarUpload = null;
    this.setData({
      profileEditor: {
        visible: true,
        nickname: this.data.authenticated ? this.data.profile.nickname : '',
        avatarPath: '',
        avatarPreview: this.data.profile.avatarImage
      }
    });
  },
  closeProfileEditor() {
    if (this.data.savingProfile || this.data.avatarPreparing) return;
    this.pendingAvatarUpload = null;
    this.setData({ 'profileEditor.visible': false });
  },
  stopPropagation() {},
  onNicknameInput(event) {
    this.setData({ 'profileEditor.nickname': String(event.detail.value || '').slice(0, 16) });
  },
  async onChooseAvatar(event) {
    const avatarPath = String(event.detail.avatarUrl || '').trim();
    if (!avatarPath) return;
    this.pendingAvatarUpload = null;
    this.setData({
      'profileEditor.avatarPath': avatarPath,
      'profileEditor.avatarPreview': avatarPath,
      avatarPreparing: true
    });
    try {
      this.pendingAvatarUpload = await prepareAvatarUpload(avatarPath);
    } catch (error) {
      // DevTools may expose chooseAvatar as a renderable http://tmp URL that
      // cannot be read through FileSystemManager. wx.uploadFile can send it.
      this.pendingAvatarUpload = null;
    } finally {
      this.setData({ avatarPreparing: false });
    }
  },
  async uploadProfileAvatar(filePath, preparedAvatar) {
    if (preparedAvatar) {
      return request('/api/uploads/image', {
        method: 'POST',
        data: preparedAvatar
      });
    }
    return uploadFile('/api/uploads/image-file', filePath, { name: 'file' });
  },
  async createWechatSession(nickname) {
    if (!wx.login) throw new Error('当前环境不支持微信登录');
    const loginResult = await new Promise((resolve, reject) => wx.login({ success: resolve, fail: reject }));
    if (!loginResult.code) throw new Error('未获取到微信登录凭证');
    const login = await request('/api/auth/wechat-login', {
      method: 'POST',
      data: { code: loginResult.code, nickname, profileConfirmed: false }
    });
    if (!login.sessionId) throw new Error('微信登录状态未生效，请重试');
    wx.setStorageSync('lotteryToken', login.sessionId);
    return login.profile;
  },
  async confirmProfile() {
    if (this.data.savingProfile) return;
    if (this.data.avatarPreparing) {
      wx.showToast({ title: '头像正在处理，请稍候', icon: 'none' });
      return;
    }
    const wasAuthenticated = this.data.authenticated;
    const nickname = String(this.data.profileEditor.nickname || '').trim();
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }
    this.setData({ savingProfile: true });
    try {
      await requirePrivacyAuthorization();
      wx.showLoading({ title: wasAuthenticated ? '保存中' : '登录中' });
      let profile = wasAuthenticated
        ? (wx.getStorageSync('lotteryProfile') || {})
        : await this.createWechatSession(nickname);
      let avatar = this.data.rawAvatar;
      if (this.data.profileEditor.avatarPath) {
        const upload = await this.uploadProfileAvatar(
          this.data.profileEditor.avatarPath,
          this.pendingAvatarUpload
        );
        avatar = upload.url;
      }
      profile = await request('/api/me/profile', {
        method: 'PUT',
        data: { nickname, avatar }
      });
      wx.setStorageSync('lotteryProfile', profile);
      getApp().globalData.user = profile;
      this.pendingAvatarUpload = null;
      this.setData({ 'profileEditor.visible': false });
      await this.loadOverview({ quiet: true });
      wx.hideLoading();
      wx.showToast({ title: wasAuthenticated ? '资料已保存' : '登录成功', icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      if (!wasAuthenticated) {
        wx.removeStorageSync('lotteryToken');
        wx.removeStorageSync('lotteryProfile');
        getApp().globalData.user = null;
      }
      wx.showToast({ title: error.message || '登录失败', icon: 'none' });
    } finally {
      this.setData({ savingProfile: false });
    }
  },
  openFeature(event) {
    const key = event.currentTarget.dataset.key;
    const publicKeys = ['settings', 'help'];
    if (!this.data.authenticated && !publicKeys.includes(key)) {
      this.login();
      return;
    }
    const routes = {
      wallet: '/pages/wallet/wallet',
      coupons: '/pages/coupons/coupons',
      orders: '/pages/orders/orders',
      mall: '/pages/mall/mall',
      personal: '/pages/personal/personal',
      creatorHome: '/pages/personal/personal',
      authorization: '/pages/official-account/official-account',
      smartPromotion: '/pages/smart-promotion/smart-promotion',
      messages: '/pages/messages/messages',
      partnership: '/pages/partnership/partnership',
      settings: '/pages/settings/settings',
      help: '/pages/help/help',
      activities: '/pages/creator-tools/creator-tools?mode=activities',
      claims: '/pages/creator-tools/creator-tools?mode=claims',
      team: '/pages/creator-tools/creator-tools?mode=team',
      drafts: '/pages/creator-tools/creator-tools?mode=drafts',
      blacklist: '/pages/creator-tools/creator-tools?mode=blacklist',
      growth: '/pages/creator-tools/creator-tools?mode=growth',
      prizes: '/pages/creator-tools/creator-tools?mode=prizes'
    };
    if (key === 'launch') {
      wx.switchTab({ url: '/pages/create/create' });
      return;
    }
    if (routes[key]) {
      wx.navigateTo({ url: routes[key] });
      return;
    }
    if (['all', 'created', 'won'].includes(key)) {
      wx.setStorageSync('recordDefaultTab', key === 'won' ? 'won' : key === 'created' ? 'created' : 'joined');
      wx.navigateTo({ url: '/pages/records/records' });
    }
  }
});
