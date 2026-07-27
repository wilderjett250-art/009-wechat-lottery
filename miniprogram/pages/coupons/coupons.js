const { request } = require('../../utils/request');

Page({
  data: {
    coupons: []
  },
  onShow() {
    wx.setNavigationBarColor({
      frontColor: '#000000',
      backgroundColor: '#f5f5f5'
    });
    this.loadCoupons();
  },
  async loadCoupons() {
    try {
      const coupons = await request('/api/me/coupons');
      this.setData({
        coupons: (coupons || []).map(item => ({
          ...item,
          expiresText: `有效期至 ${String(item.expiresAt || '').slice(0, 10)}`,
          statusText: item.status === 'available' ? '可使用' : '已使用'
        }))
      });
    } catch (error) {
      wx.showToast({ title: '优惠券加载失败', icon: 'none' });
    }
  }
});
