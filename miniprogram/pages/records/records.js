const { request, assetUrl } = require('../../utils/request');
const RECENT_ACTIVITY_STORAGE_KEY = 'lotteryRecentActivitiesV1';

const emptyTextMap = {
  recent: '暂无浏览记录',
  created: '暂无发起的抽奖',
  joined: '暂无参与记录',
  won: '暂无中奖记录'
};

const recordNoteMap = {
  recent: '仅展示最近浏览的20个活动',
  created: '展示最近发起的抽奖活动',
  joined: '展示最近参与的抽奖活动',
  won: '展示已中奖的抽奖记录'
};

function formatRecordDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间待定';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function recordStatus(activity) {
  if (activity.status === 'draft') {
    return { statusText: '测试', statusClass: 'status-draft' };
  }
  if (activity.status === 'drawn') {
    return { statusText: '已开奖', statusClass: 'status-done' };
  }
  if (activity.status === 'ended') {
    return { statusText: '已结束', statusClass: 'status-done' };
  }
  if (new Date(activity.drawAt).getTime() <= Date.now()) {
    return { statusText: '开奖中', statusClass: 'status-live' };
  }
  return { statusText: '进行中', statusClass: 'status-live' };
}

function buildRecord(activity) {
  const participantCount = Number(activity.metrics?.participantCount || activity.participants?.length || 0);
  return {
    id: activity.id,
    title: activity.title,
    image: assetUrl(activity.image),
    recordMeta: `${formatRecordDate(activity.drawAt)} · ${participantCount}人参与`,
    ...recordStatus(activity)
  };
}

function selectRecords(recordSets, activeTab) {
  return [...(recordSets[activeTab] || [])]
    .sort((a, b) => {
      const left = activeTab === 'recent' ? b.viewedAt : b.drawAt;
      const right = activeTab === 'recent' ? a.viewedAt : a.drawAt;
      return new Date(left).getTime() - new Date(right).getTime();
    })
    .slice(0, activeTab === 'created' ? 20 : 50);
}

function readRecentRecords() {
  try {
    const records = wx.getStorageSync(RECENT_ACTIVITY_STORAGE_KEY);
    return Array.isArray(records) ? records.slice(0, 20) : [];
  } catch (error) {
    return [];
  }
}

Page({
  data: {
    activeTab: 'recent',
    recentClass: 'active',
    createdClass: '',
    joinedClass: '',
    wonClass: '',
    recordSets: { recent: [], created: [], joined: [], won: [] },
    records: [],
    recordNote: recordNoteMap.recent,
    emptyText: emptyTextMap.recent
  },
  onShow() {
    const defaultTab = wx.getStorageSync('recordDefaultTab');
    if (defaultTab) {
      wx.removeStorageSync('recordDefaultTab');
      this.switchTo(defaultTab);
    }
    this.loadRecords();
  },
  switchTab(event) {
    const activeTab = event.currentTarget.dataset.tab;
    this.switchTo(activeTab);
  },
  switchTo(activeTab) {
    const records = selectRecords(this.data.recordSets, activeTab).map(buildRecord);
    this.setData({
      activeTab,
      recentClass: activeTab === 'recent' ? 'active' : '',
      createdClass: activeTab === 'created' ? 'active' : '',
      joinedClass: activeTab === 'joined' ? 'active' : '',
      wonClass: activeTab === 'won' ? 'active' : '',
      records,
      recordNote: recordNoteMap[activeTab] || recordNoteMap.recent,
      emptyText: emptyTextMap[activeTab] || '暂无记录'
    });
  },
  async loadRecords() {
    try {
      const recordSets = {
        recent: readRecentRecords(),
        ...(await request('/api/me/records'))
      };
      const records = selectRecords(recordSets, this.data.activeTab).map(buildRecord);
      this.setData({
        recordSets,
        records
      });
    } catch (error) {
      const recordSets = { recent: readRecentRecords(), created: [], joined: [], won: [] };
      this.setData({
        recordSets,
        records: selectRecords(recordSets, this.data.activeTab).map(buildRecord)
      });
    }
  },
  openActivity(event) {
    wx.navigateTo({ url: `/pages/detail/detail?id=${event.currentTarget.dataset.id}` });
  },
  openRecommend() {
    if (this.data.records[0]) {
      wx.navigateTo({ url: `/pages/detail/detail?id=${this.data.records[0].id}` });
      return;
    }
    wx.switchTab({ url: '/pages/index/index' });
  },
  openTemplate() {
    wx.switchTab({ url: '/pages/create/create' });
  }
});
