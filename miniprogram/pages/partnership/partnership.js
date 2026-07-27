const { request } = require('../../utils/request');

Page({
  data: {
    submitting: false,
    form: {
      company: '',
      contactName: '',
      phone: '',
      needs: ''
    }
  },
  updateField(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: event.detail.value });
  },
  async submit() {
    if (this.data.submitting) return;
    const form = this.data.form;
    if (!form.contactName.trim() || !form.phone.trim() || !form.needs.trim()) {
      wx.showToast({ title: '请完整填写联系人、联系电话和合作需求', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    try {
      await request('/api/me/partnerships', { method: 'POST', data: form });
      wx.showModal({
        title: '提交成功',
        content: '合作申请已进入后台，运营人员会按填写的联系方式与您沟通。',
        showCancel: false,
        success: () => wx.navigateBack()
      });
    } catch (error) {
      wx.showToast({ title: error.message || '提交失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
