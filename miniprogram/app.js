const { initializePrivacyAuthorization } = require('./utils/privacy');

App({
  globalData: {
    user: null,
    selectedActivityId: ''
  },
  onLaunch() {
    initializePrivacyAuthorization();
    const user = wx.getStorageSync('lotteryProfile');
    if (user) this.globalData.user = user;
  }
});
