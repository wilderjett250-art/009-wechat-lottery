const { request } = require('../../utils/request');
const { FALLBACK_METRICS, applyNavigationMetrics } = require('../../utils/navigation');

Page({
  data: {
    navMetrics: FALLBACK_METRICS,
    authenticated: false
  },
  onLoad() {
    applyNavigationMetrics(this);
  },
  onShow() {
    this.setData({ authenticated: Boolean(wx.getStorageSync('lotteryToken')) });
  },
  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/profile/profile' });
  },
  openSubscriptionSettings() {
    if (!wx.openSetting) {
      wx.showToast({ title: '请在微信中管理订阅消息', icon: 'none' });
      return;
    }
    wx.openSetting({ withSubscriptions: true });
  },
  openAddress() {
    wx.navigateTo({ url: '/pages/address/address' });
  },
  openHelp(event) {
    const section = event.currentTarget.dataset.section || 'faq';
    wx.navigateTo({ url: `/pages/help/help?section=${section}` });
  },
  checkUpdate() {
    if (!wx.getUpdateManager) {
      wx.showToast({ title: '当前已是最新版本', icon: 'none' });
      return;
    }
    const updateManager = wx.getUpdateManager();
    updateManager.onCheckForUpdate(result => {
      if (!result.hasUpdate) wx.showToast({ title: '当前已是最新版本', icon: 'none' });
    });
    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: '新版本已准备好',
        content: '重新启动后即可使用新版本。',
        success: result => {
          if (result.confirm) updateManager.applyUpdate();
        }
      });
    });
    updateManager.onUpdateFailed(() => wx.showToast({ title: '更新包下载失败', icon: 'none' }));
  },
  async logout() {
    const result = await new Promise(resolve => {
      wx.showModal({
        title: '退出登录',
        content: '退出后可随时使用微信便捷登录。',
        success: resolve,
        fail: () => resolve({ confirm: false })
      });
    });
    if (!result.confirm) return;
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      // 本地登录状态仍需要清除，服务端会按会话有效期自动回收。
    }
    wx.removeStorageSync('lotteryToken');
    wx.removeStorageSync('lotteryProfile');
    wx.removeStorageSync('lotteryLocalProfile');
    getApp().globalData.user = null;
    wx.switchTab({ url: '/pages/profile/profile' });
  }
});
