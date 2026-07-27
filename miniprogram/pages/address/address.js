const { request } = require('../../utils/request');
const { requirePrivacyAuthorization } = require('../../utils/privacy');

function emptyAddress() {
  return {
    userName: '',
    telNumber: '',
    provinceName: '',
    cityName: '',
    countyName: '',
    detailInfo: '',
    postalCode: ''
  };
}

Page({
  data: {
    form: emptyAddress(),
    saving: false
  },
  onShow() {
    wx.setNavigationBarColor({ frontColor: '#000000', backgroundColor: '#f5f5f5' });
    this.loadAddress();
  },
  async loadAddress() {
    try {
      const address = await request('/api/me/address');
      if (address) this.setData({ form: { ...emptyAddress(), ...address } });
    } catch (error) {
      wx.showToast({ title: error.message || '地址加载失败', icon: 'none' });
    }
  },
  onInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
  },
  async chooseWechatAddress() {
    if (!wx.chooseAddress) {
      wx.showToast({ title: '当前环境不支持微信地址', icon: 'none' });
      return;
    }
    try {
      await requirePrivacyAuthorization();
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
      return;
    }
    wx.chooseAddress({
      success: address => this.setData({ form: { ...emptyAddress(), ...address } })
    });
  },
  async saveAddress() {
    if (this.data.saving) return;
    const form = this.data.form;
    if (!form.userName.trim() || !form.telNumber.trim() || !form.detailInfo.trim()) {
      wx.showToast({ title: '请完整填写收货信息', icon: 'none' });
      return;
    }
    this.setData({ saving: true });
    try {
      await request('/api/me/address', { method: 'PUT', data: form });
      wx.showToast({ title: '地址已保存', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '地址保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  }
});
