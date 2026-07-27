const { request, assetUrl } = require('../../utils/request');
const { requestConfiguredLotterySubscription, subscriptionMessage } = require('../../utils/subscribe');
const { FALLBACK_METRICS, applyNavigationMetrics } = require('../../utils/navigation');
const { requirePrivacyAuthorization } = require('../../utils/privacy');

const REMINDER_KEY = 'cashReminderMapV3';

function formatCountdown(value) {
  const diff = Math.max(0, new Date(value).getTime() - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = number => String(number).padStart(2, '0');
  return days > 0
    ? `${days}天 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatCashLabel(value) {
  const date = new Date(value);
  const today = new Date();
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  const afterTomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
  if (date.toDateString() === tomorrow.toDateString()) return '明日开奖';
  if (date.toDateString() === afterTomorrow.toDateString()) return '后天开奖';
  return `${date.getMonth() + 1}月${date.getDate()}日开奖`;
}

function mapActivity(activity) {
  return {
    ...activity,
    image: assetUrl(activity.image),
    countdownText: formatCountdown(activity.drawAt)
  };
}

Page({
  data: {
    navMetrics: FALLBACK_METRICS,
    featuredPrizes: [],
    cashActivities: [],
    todayPrizes: [],
    loading: true,
    compactNav: false
  },
  onLoad() {
    applyNavigationMetrics(this);
  },
  onShow() {
    wx.showTabBar();
    wx.setNavigationBarTitle({ title: '抽奖助手' });
    wx.setNavigationBarColor({ frontColor: '#000000', backgroundColor: '#f4f4f4' });
    this.loadHome();
    this.countdownTimer = setInterval(() => this.refreshCountdowns(), 1000);
  },
  onHide() {
    clearInterval(this.countdownTimer);
  },
  onUnload() {
    clearInterval(this.countdownTimer);
  },
  onPageScroll(event) {
    const compactNav = Number(event.scrollTop || 0) > 260;
    if (compactNav !== this.data.compactNav) this.setData({ compactNav });
  },
  async loadHome() {
    try {
      const home = await request('/api/home');
      const remindedMap = wx.getStorageSync(REMINDER_KEY) || {};
      const hasSession = Boolean(wx.getStorageSync('lotteryToken'));
      this.setData({
        featuredPrizes: (home.official || []).map(mapActivity),
        cashActivities: (home.cash || []).map(item => ({
          ...mapActivity(item),
          cashLabel: formatCashLabel(item.drawAt),
          reminded: hasSession ? Boolean(item.reminderEnabled) : Boolean(remindedMap[item.id])
        })),
        todayPrizes: (home.today || []).map(mapActivity),
        loading: false
      });
    } catch (error) {
      this.setData({ featuredPrizes: [], cashActivities: [], todayPrizes: [], loading: false });
      wx.showToast({ title: error.message || '首页加载失败', icon: 'none' });
    }
  },
  refreshCountdowns() {
    this.setData({
      featuredPrizes: this.data.featuredPrizes.map(mapActivity),
      cashActivities: this.data.cashActivities.map(item => ({ ...mapActivity(item), cashLabel: item.cashLabel, reminded: item.reminded })),
      todayPrizes: this.data.todayPrizes.map(mapActivity)
    });
  },
  async ensureUserSession() {
    const token = wx.getStorageSync('lotteryToken');
    if (token) return;
    await requirePrivacyAuthorization();
    const profileResult = await new Promise(resolve => {
      if (!wx.getUserProfile) return resolve({});
      wx.getUserProfile({
        desc: '用于展示抽奖参与者身份',
        success: result => resolve(result.userInfo || {}),
        fail: () => resolve({})
      });
    });
    const loginResult = await new Promise((resolve, reject) => {
      wx.login({ success: resolve, fail: reject });
    });
    if (!loginResult.code) throw new Error('未获取到微信登录凭证');
    const login = await request('/api/auth/wechat-login', {
      method: 'POST',
      data: { code: loginResult.code, nickname: profileResult.nickName, avatar: profileResult.avatarUrl }
    });
    wx.setStorageSync('lotteryToken', login.sessionId);
    wx.setStorageSync('lotteryProfile', login.profile);
    getApp().globalData.user = login.profile;
  },
  openActivity(event) {
    const id = event.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },
  async remindCash(event) {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    try {
      await this.ensureUserSession();
      const subscribeResult = await requestConfiguredLotterySubscription('draw_reminder');
      if (subscribeResult.accepted) {
        await request('/api/me/subscriptions', {
          method: 'POST',
          data: { activityId: id, type: 'draw_reminder' }
        });
      }
      const cashActivities = this.data.cashActivities.map(item => (
        item.id === id ? { ...item, reminded: item.reminded || subscribeResult.accepted } : item
      ));
      this.setData({ cashActivities });
      const map = Object.fromEntries(cashActivities.filter(item => item.reminded).map(item => [item.id, true]));
      wx.setStorageSync(REMINDER_KEY, map);
      const message = subscriptionMessage(subscribeResult, '已保存开奖提醒。');
      wx.showModal({ title: message.title, content: message.content, showCancel: false });
    } catch (error) {
      wx.showToast({ title: error.message || '提醒设置失败', icon: 'none' });
    }
  },
  scrollTop() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 });
  }
});
