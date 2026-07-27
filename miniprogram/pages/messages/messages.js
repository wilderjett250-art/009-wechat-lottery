const { request } = require('../../utils/request');

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

Page({
  data: {
    loading: true,
    messages: []
  },
  onShow() {
    wx.setNavigationBarColor({ frontColor: '#000000', backgroundColor: '#f5f5f5' });
    this.loadMessages();
  },
  async loadMessages() {
    try {
      const messages = await request('/api/me/messages');
      this.setData({
        loading: false,
        messages: (messages || []).map(item => ({ ...item, timeText: formatTime(item.createdAt) }))
      });
    } catch (error) {
      this.setData({ loading: false, messages: [] });
      wx.showToast({ title: error.message || '消息加载失败', icon: 'none' });
    }
  },
  openMessage(event) {
    const activityId = event.currentTarget.dataset.activityId;
    if (activityId) wx.navigateTo({ url: `/pages/detail/detail?id=${activityId}` });
  }
});
