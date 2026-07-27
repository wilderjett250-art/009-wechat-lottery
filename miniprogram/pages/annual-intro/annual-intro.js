const { FALLBACK_METRICS, applyNavigationMetrics } = require('../../utils/navigation');

Page({
  data: { navMetrics: FALLBACK_METRICS },
  onLoad() {
    applyNavigationMetrics(this);
  },
  goBack() {
    wx.navigateBack();
  },
  startAnnualLottery() {
    wx.navigateTo({ url: '/pages/launch/launch?preset=annual&standalone=1' });
  }
});
