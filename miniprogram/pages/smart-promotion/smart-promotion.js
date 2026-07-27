const { request, assetUrl } = require('../../utils/request');

Page({
  data: {
    loading: true,
    totals: { views: 0, shares: 0, participants: 0 },
    activities: []
  },
  onShow() {
    this.loadAnalytics();
  },
  async loadAnalytics() {
    try {
      const result = await request('/api/me/homepage');
      const activities = (result.activities || []).map(activity => ({
        ...activity,
        image: assetUrl(activity.image),
        viewCount: Number(activity.metrics?.viewCount || 0),
        shareCount: Number(activity.metrics?.shareCount || 0),
        participantCount: Number(activity.metrics?.participantCount || 0)
      }));
      this.setData({
        loading: false,
        activities,
        totals: activities.reduce((totals, activity) => ({
          views: totals.views + activity.viewCount,
          shares: totals.shares + activity.shareCount,
          participants: totals.participants + activity.participantCount
        }), { views: 0, shares: 0, participants: 0 })
      });
    } catch (error) {
      this.setData({ loading: false, activities: [] });
      wx.showToast({ title: error.message || '推广数据加载失败', icon: 'none' });
    }
  },
  openActivity(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` });
  }
});
