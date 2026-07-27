const { request, assetUrl } = require('../../utils/request');
const { FALLBACK_METRICS, applyNavigationMetrics } = require('../../utils/navigation');

const MODE_INFO = {
  activities: { title: '活动管理', emptyText: '还没有发起过抽奖活动' },
  claims: { title: '中奖核销', emptyText: '暂无待管理的中奖记录' },
  team: { title: '团队管理', emptyText: '暂无团队成员' },
  drafts: { title: '草稿箱', emptyText: '暂无抽奖草稿' },
  blacklist: { title: '黑名单管理', emptyText: '暂无黑名单用户' },
  growth: { title: '成长中心', emptyText: '' },
  prizes: { title: '我的奖品', emptyText: '暂无中奖奖品' }
};

const STATUS_LABELS = {
  draft: '草稿',
  live: '进行中',
  drawn: '已开奖',
  ended: '已结束'
};

const ROLE_LABELS = {
  manager: '管理员',
  verifier: '核销员',
  viewer: '只读成员'
};

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间待定';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function confirmModal(options) {
  return new Promise(resolve => {
    wx.showModal({ ...options, success: resolve, fail: () => resolve({ confirm: false }) });
  });
}

function actionSheet(itemList) {
  return new Promise(resolve => {
    wx.showActionSheet({ itemList, success: resolve, fail: () => resolve({ tapIndex: -1 }) });
  });
}

Page({
  data: {
    navMetrics: FALLBACK_METRICS,
    mode: 'activities',
    title: '活动管理',
    emptyText: '',
    loading: true,
    activities: [],
    claims: [],
    createdTeam: [],
    joinedTeam: [],
    blacklistEntries: [],
    blacklistCandidates: [],
    prizes: [],
    counts: {},
    overview: {
      stats: { total: 0, created: 0, won: 0 },
      creator: {},
      profile: {}
    }
  },
  onLoad(options = {}) {
    applyNavigationMetrics(this);
    const mode = MODE_INFO[options.mode] ? options.mode : 'activities';
    this.setData({ mode, ...MODE_INFO[mode] });
  },
  onShow() {
    this.loadData();
  },
  onPullDownRefresh() {
    this.loadData().finally(() => wx.stopPullDownRefresh());
  },
  goBack() {
    wx.navigateBack();
  },
  async loadData() {
    this.setData({ loading: true });
    try {
      const mode = this.data.mode;
      if (mode === 'activities' || mode === 'drafts') {
        const result = await request('/api/me/creator-activities');
        const activities = (result.activities || [])
          .filter(item => mode !== 'drafts' || item.status === 'draft')
          .map(item => ({
            ...item,
            imageUrl: assetUrl(item.image),
            statusLabel: STATUS_LABELS[item.status] || item.status,
            drawAtText: formatDate(item.drawAt),
            updatedAtText: formatDate(item.updatedAt)
          }));
        this.setData({ activities, counts: result.counts || {} });
      } else if (mode === 'claims') {
        const claims = (await request('/api/me/claims')).map(item => ({
          ...item,
          createdAtText: formatDate(item.createdAt),
          claimedAtText: item.claimedAt ? formatDate(item.claimedAt) : '',
          winner: { ...item.winner, avatarUrl: assetUrl(item.winner?.avatar) }
        }));
        this.setData({ claims });
      } else if (mode === 'team') {
        const team = await request('/api/me/team');
        this.setData({
          createdTeam: (team.created || []).map(item => ({ ...item, roleLabel: ROLE_LABELS[item.role] || item.role })),
          joinedTeam: (team.joined || []).map(item => ({ ...item, roleLabel: ROLE_LABELS[item.role] || item.role }))
        });
      } else if (mode === 'blacklist') {
        const result = await request('/api/me/blacklist');
        this.setData({ blacklistEntries: result.entries || [], blacklistCandidates: result.candidates || [] });
      } else if (mode === 'growth') {
        const overview = await request('/api/me/overview');
        overview.profile = {
          ...(overview.profile || {}),
          avatarUrl: assetUrl(overview.profile?.avatar || '/assets/avatar-default.svg')
        };
        this.setData({ overview });
      } else if (mode === 'prizes') {
        const prizes = (await request('/api/me/prizes')).map(item => ({
          ...item,
          createdAtText: formatDate(item.createdAt),
          claimedAtText: item.claimedAt ? formatDate(item.claimedAt) : ''
        }));
        this.setData({ prizes });
      }
    } catch (error) {
      wx.showToast({ title: error.message || '数据加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
  openActivity(event) {
    const id = event.currentTarget.dataset.id;
    if (id) wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  },
  async updateActivityStatus(event) {
    const id = event.currentTarget.dataset.id;
    const status = event.currentTarget.dataset.status;
    const actionText = status === 'live' ? '发布' : '结束';
    const dialog = await confirmModal({
      title: `${actionText}活动`,
      content: status === 'live' ? '发布后活动会对用户开放参与，确定继续吗？' : '结束后用户将不能继续参与，确定继续吗？'
    });
    if (!dialog.confirm) return;
    try {
      wx.showLoading({ title: '处理中' });
      await request(`/api/me/activities/${id}/status`, { method: 'PATCH', data: { status } });
      await this.loadData();
      wx.hideLoading();
      wx.showToast({ title: `${actionText}成功`, icon: 'success' });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '操作失败', icon: 'none' });
    }
  },
  async toggleClaim(event) {
    const id = event.currentTarget.dataset.id;
    const currentClaimed = event.currentTarget.dataset.claimed === true || event.currentTarget.dataset.claimed === 'true';
    const claimed = !currentClaimed;
    const dialog = await confirmModal({
      title: claimed ? '确认核销' : '撤销核销',
      content: claimed ? '请确认奖品已经交付给中奖用户。' : '确定恢复为未核销状态吗？'
    });
    if (!dialog.confirm) return;
    try {
      await request(`/api/me/claims/${id}`, { method: 'PUT', data: { claimed } });
      await this.loadData();
      wx.showToast({ title: claimed ? '核销成功' : '已撤销核销', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '核销失败', icon: 'none' });
    }
  },
  async createInvitation() {
    const roleResult = await actionSheet(['管理员：活动和核销', '核销员：仅核销奖品', '只读成员：查看数据']);
    if (roleResult.tapIndex < 0) return;
    const roles = ['manager', 'verifier', 'viewer'];
    const nameResult = await confirmModal({
      title: '邀请团队成员',
      content: '',
      editable: true,
      placeholderText: '输入成员备注，例如：门店核销员'
    });
    if (!nameResult.confirm) return;
    const displayName = String(nameResult.content || '').trim();
    if (!displayName) {
      wx.showToast({ title: '请输入成员备注', icon: 'none' });
      return;
    }
    try {
      const invitation = await request('/api/me/team/invitations', {
        method: 'POST',
        data: { displayName, role: roles[roleResult.tapIndex] }
      });
      await this.loadData();
      wx.setClipboardData({ data: invitation.inviteCode });
    } catch (error) {
      wx.showToast({ title: error.message || '邀请创建失败', icon: 'none' });
    }
  },
  async acceptInvitation() {
    const result = await confirmModal({
      title: '加入发起人团队',
      content: '',
      editable: true,
      placeholderText: '输入 8 位团队邀请码'
    });
    if (!result.confirm) return;
    const inviteCode = String(result.content || '').trim();
    if (!inviteCode) return;
    try {
      await request('/api/me/team/invitations/accept', { method: 'POST', data: { inviteCode } });
      await this.loadData();
      wx.showToast({ title: '已加入团队', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '加入失败', icon: 'none' });
    }
  },
  copyInvite(event) {
    const code = event.currentTarget.dataset.code;
    if (code) wx.setClipboardData({ data: code });
  },
  async removeTeam(event) {
    const id = event.currentTarget.dataset.id;
    const dialog = await confirmModal({ title: '移除团队关系', content: '确定移除该团队成员或退出该团队吗？' });
    if (!dialog.confirm) return;
    try {
      await request(`/api/me/team/${id}`, { method: 'DELETE' });
      await this.loadData();
      wx.showToast({ title: '已移除', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '移除失败', icon: 'none' });
    }
  },
  async addBlacklist() {
    const candidates = this.data.blacklistCandidates.slice(0, 6);
    if (!candidates.length) {
      wx.showToast({ title: '暂无可添加的活动参与者', icon: 'none' });
      return;
    }
    const result = await actionSheet(candidates.map(item => `${item.nickname} · ${item.activityTitle}`.slice(0, 28)));
    if (result.tapIndex < 0) return;
    try {
      await request('/api/me/blacklist', {
        method: 'POST',
        data: { participantId: candidates[result.tapIndex].participantId }
      });
      await this.loadData();
      wx.showToast({ title: '已加入黑名单', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '添加失败', icon: 'none' });
    }
  },
  async removeBlacklist(event) {
    const id = event.currentTarget.dataset.id;
    const dialog = await confirmModal({ title: '移出黑名单', content: '移出后该用户可以再次参与你发起的抽奖。' });
    if (!dialog.confirm) return;
    try {
      await request(`/api/me/blacklist/${id}`, { method: 'DELETE' });
      await this.loadData();
      wx.showToast({ title: '已移出黑名单', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '移除失败', icon: 'none' });
    }
  }
});
