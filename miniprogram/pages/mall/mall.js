const { request, assetUrl } = require('../../utils/request');

Page({
  data: { activities: [], loading: true },
  onShow() { this.load(); },
  async load() {
    try {
      const activities = await request('/api/mall');
      this.setData({ activities: activities.map(item => ({ ...item, image: assetUrl(item.image) })), loading: false });
    } catch (error) {
      this.setData({ activities: [], loading: false });
      wx.showToast({ title: error.message || '商城加载失败', icon: 'none' });
    }
  },
  open(event) { wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` }); }
});
