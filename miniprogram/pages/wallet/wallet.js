const { request } = require('../../utils/request');

function formatAmount(value) {
  return Number(value || 0).toFixed(2);
}

Page({
  data: {
    balance: '0.00',
    frozen: '0.00',
    records: [],
    withdrawing: false
  },
  onShow() {
    wx.setNavigationBarColor({
      frontColor: '#000000',
      backgroundColor: '#f5f5f5'
    });
    this.loadWallet();
  },
  async loadWallet() {
    try {
      const wallet = await request('/api/me/wallet');
      this.setData({
        balance: formatAmount(wallet.balance),
        frozen: formatAmount(wallet.frozen),
        records: (wallet.records || []).map(item => ({
          ...item,
          amountText: `${Number(item.amount || 0) >= 0 ? '+' : ''}${formatAmount(item.amount)}`,
          amountClass: Number(item.amount || 0) >= 0 ? 'income' : 'expense',
          statusText: item.status === 'pending' ? '处理中' : item.status === 'rejected' ? '已退回' : '',
          dateText: String(item.createdAt || '').replace('T', ' ').slice(0, 16)
        }))
      });
    } catch (error) {
      wx.showToast({ title: '余额加载失败', icon: 'none' });
    }
  },
  async withdraw() {
    if (this.data.withdrawing) return;
    if (Number(this.data.balance) <= 0) {
      wx.showToast({ title: '当前没有可提现余额', icon: 'none' });
      return;
    }
    const result = await new Promise(resolve => {
      wx.showModal({
        title: '申请提现',
        content: `可提现 ¥${this.data.balance}`,
        editable: true,
        placeholderText: '输入提现金额',
        confirmText: '提交申请',
        success: resolve,
        fail: () => resolve({ confirm: false })
      });
    });
    if (!result.confirm) return;
    const amount = Number(result.content || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      wx.showToast({ title: '请输入有效的提现金额', icon: 'none' });
      return;
    }
    this.setData({ withdrawing: true });
    try {
      await request('/api/me/withdrawals', { method: 'POST', data: { amount } });
      await this.loadWallet();
      wx.showModal({
        title: '申请已提交',
        content: '提现申请已进入后台处理，可在余额明细中查看状态。',
        showCancel: false
      });
    } catch (error) {
      wx.showToast({ title: error.message || '提现申请失败', icon: 'none' });
    } finally {
      this.setData({ withdrawing: false });
    }
  }
});
