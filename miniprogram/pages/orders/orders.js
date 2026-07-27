const { request } = require('../../utils/request');

const orderStatusText = {
  creating: '创建中',
  pending: '待支付',
  paid: '已支付',
  consumed: '已使用',
  failed: '支付失败',
  fulfilled: '已完成',
  shipped: '已发货',
  refunded: '已退款',
  closed: '已关闭'
};

Page({
  data: {
    orders: []
  },
  onShow() {
    wx.setNavigationBarColor({
      frontColor: '#000000',
      backgroundColor: '#f5f5f5'
    });
    this.loadOrders();
  },
  async loadOrders() {
    try {
      const orders = await request('/api/me/orders');
      this.setData({
        orders: (orders || []).map(item => ({
          ...item,
          amountText: Number(item.amount || 0).toFixed(2),
          dateText: String(item.createdAt || '').slice(0, 10),
          statusText: orderStatusText[item.status] || '处理中'
        }))
      });
    } catch (error) {
      wx.showToast({ title: '订单加载失败', icon: 'none' });
    }
  }
});
