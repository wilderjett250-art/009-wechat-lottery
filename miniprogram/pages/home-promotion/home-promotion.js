const { request, assetUrl } = require('../../utils/request');

function mapActivity(activity) {
  return {
    ...activity,
    image: assetUrl(activity.image),
    promotionEnabled: activity.homePlacement === 'official' || activity.promotion?.platformRecommend === true,
    participantCount: Number(activity.metrics?.participantCount || 0)
  };
}

Page({
  data: {
    loading: true,
    activities: []
  },
  onShow() {
    this.loadActivities();
  },
  async loadActivities() {
    try {
      const result = await request('/api/me/homepage');
      this.setData({
        loading: false,
        activities: (result.activities || []).map(mapActivity)
      });
    } catch (error) {
      this.setData({ loading: false, activities: [] });
      wx.showToast({ title: error.message || '推广活动加载失败', icon: 'none' });
    }
  },
  async togglePromotion(event) {
    const id = event.currentTarget.dataset.id;
    const enabled = Boolean(event.detail.value);
    const previous = this.data.activities;
    this.setData({
      activities: previous.map(item => item.id === id ? { ...item, promotionEnabled: enabled } : item)
    });
    try {
      const activity = await request(`/api/me/activities/${id}/home-promotion`, {
        method: 'POST',
        data: { enabled }
      });
      this.setData({
        activities: this.data.activities.map(item => item.id === id ? mapActivity(activity) : item)
      });
      wx.showToast({ title: enabled ? '已加入首页推广' : '已停止首页推广', icon: 'success' });
    } catch (error) {
      this.setData({ activities: previous });
      wx.showToast({ title: error.message || '推广设置失败', icon: 'none' });
    }
  },
  createActivity() {
    wx.switchTab({ url: '/pages/create/create' });
  }
});
