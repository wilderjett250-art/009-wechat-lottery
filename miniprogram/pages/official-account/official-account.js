const { request } = require('../../utils/request');
const { FALLBACK_METRICS, applyNavigationMetrics } = require('../../utils/navigation');
const { requirePrivacyAuthorization } = require('../../utils/privacy');

const SELECTION_KEY = 'lotteryOfficialAccountSelection';

Page({
  data: {
    navMetrics: FALLBACK_METRICS,
    accounts: [],
    selectedKey: '',
    loading: true
  },
  onLoad() {
    applyNavigationMetrics(this);
  },
  onShow() {
    wx.setNavigationBarTitle({ title: '授权申请' });
    wx.setNavigationBarColor({
      frontColor: '#000000',
      backgroundColor: '#ffffff'
    });
    this.loadAccounts();
  },
  async ensureUserSession() {
    if (wx.getStorageSync('lotteryToken')) return;
    await requirePrivacyAuthorization();
    if (typeof wx.login !== 'function') throw new Error('当前环境不支持微信登录');
    const loginResult = await new Promise((resolve, reject) => {
      wx.login({ success: resolve, fail: reject });
    });
    if (!loginResult.code) throw new Error('微信登录凭证获取失败');
    const login = await request('/api/auth/wechat-login', {
      method: 'POST',
      data: { code: loginResult.code }
    });
    wx.setStorageSync('lotteryToken', login.sessionId);
    if (login.profile) wx.setStorageSync('lotteryProfile', login.profile);
  },
  async loadAccounts() {
    this.setData({ loading: true });
    try {
      await this.ensureUserSession();
      const result = await request('/api/integrations/official-accounts');
      const accounts = (result || []).map(account => ({
        ...account,
        key: account.appid || account.key,
        initial: String(account.name || '公').slice(0, 1)
      }));
      const stored = wx.getStorageSync(SELECTION_KEY) || {};
      const storedKey = stored.appid || stored.key || '';
      const selectedKey = accounts.some(item => item.key === storedKey)
        ? storedKey
        : '';
      this.setData({ accounts, selectedKey, loading: false });
    } catch (error) {
      this.setData({ accounts: [], selectedKey: '', loading: false });
      wx.showToast({ title: error.message || '公众号读取失败', icon: 'none' });
    }
  },
  goBack() {
    wx.navigateBack();
  },
  chooseAccount(event) {
    const account = this.data.accounts[Number(event.currentTarget.dataset.index)];
    if (!account) return;
    wx.setStorageSync(SELECTION_KEY, account);
    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel?.emit) eventChannel.emit('officialAccountSelected', account);
    wx.navigateBack();
  },
  chooseNone() {
    wx.removeStorageSync(SELECTION_KEY);
    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel?.emit) eventChannel.emit('officialAccountUnset');
    wx.navigateBack();
  },
  async addAuthorization() {
    wx.showLoading({ title: '准备授权' });
    try {
      await this.ensureUserSession();
      const authorization = await request('/api/integrations/official-accounts/authorization', {
        method: 'POST'
      });
      wx.hideLoading();
      wx.navigateTo({
        url: `/pages/official-account-auth/official-account-auth?url=${encodeURIComponent(authorization.url)}`
      });
    } catch (error) {
      wx.hideLoading();
      wx.showModal({
        title: '暂无法发起授权',
        content: error.message || '公众号授权服务暂不可用',
        showCancel: false,
        confirmText: '知道了'
      });
    }
  }
});
