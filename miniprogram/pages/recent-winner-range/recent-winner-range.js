const { request, assetUrl } = require('../../utils/request');
const { FALLBACK_METRICS, applyNavigationMetrics } = require('../../utils/navigation');

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

Page({
  data: {
    navMetrics: FALLBACK_METRICS,
    loading: true,
    activities: [],
    selectedIds: [],
    errorMessage: ''
  },
  onLoad() {
    applyNavigationMetrics(this);
    const channel = this.getOpenerEventChannel();
    channel.on('initialSelection', payload => {
      this.setData({ selectedIds: Array.isArray(payload?.ids) ? payload.ids : [] });
    });
    this.loadActivities();
  },
  async loadActivities() {
    this.setData({ loading: true, errorMessage: '' });
    try {
      const result = await request('/api/me/activities/recent-ended');
      const selected = new Set(this.data.selectedIds);
      this.setData({
        loading: false,
        activities: (result.activities || []).map(item => ({
          ...item,
          imageUrl: assetUrl(item.image),
          drawDateText: formatDate(item.drawAt || item.completedAt),
          prizeText: (item.prizeNames || []).join('、') || '活动奖品',
          selected: selected.has(item.id)
        }))
      });
    } catch (error) {
      this.setData({ loading: false, errorMessage: error.message || '近期抽奖加载失败' });
    }
  },
  toggleActivity(event) {
    const id = event.currentTarget.dataset.id;
    const activities = this.data.activities.map(item => item.id === id
      ? { ...item, selected: !item.selected }
      : item);
    this.setData({ activities, selectedIds: activities.filter(item => item.selected).map(item => item.id) });
  },
  goBack() {
    wx.navigateBack();
  },
  confirmSelection() {
    const selected = this.data.activities.filter(item => item.selected);
    if (!selected.length) {
      wx.showToast({ title: '请至少选择一个抽奖', icon: 'none' });
      return;
    }
    this.getOpenerEventChannel().emit('recentWinnerSelection', {
      ids: selected.map(item => item.id),
      titles: selected.map(item => item.title)
    });
    wx.navigateBack();
  }
});
