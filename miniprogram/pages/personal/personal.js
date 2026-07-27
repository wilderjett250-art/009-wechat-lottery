const { request, assetUrl } = require('../../utils/request');

Page({
  data: {
    loading: true,
    profile: null,
    activities: []
  },
  onShow() {
    this.load();
  },
  async load() {
    try {
      const result = await request('/api/me/homepage');
      this.setData({
        loading: false,
        profile: {
          ...result.profile,
          avatarImage: assetUrl(result.profile?.avatar || '/assets/avatar-default.svg')
        },
        activities: (result.activities || []).map(item => ({
          ...item,
          image: assetUrl(item.image)
        }))
      });
    } catch (error) {
      this.setData({ loading: false, profile: null, activities: [] });
      wx.showToast({ title: error.message || '个人主页加载失败', icon: 'none' });
    }
  },
  openActivity(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` });
  },
  createActivity() {
    wx.switchTab({ url: '/pages/create/create' });
  }
});
