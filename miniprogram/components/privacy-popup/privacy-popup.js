const {
  initializePrivacyAuthorization,
  subscribePrivacyState,
  settlePrivacyAuthorization
} = require('../../utils/privacy');

Component({
  data: {
    visible: false,
    contractName: '《小程序用户隐私保护指引》'
  },
  lifetimes: {
    attached() {
      initializePrivacyAuthorization();
      this.unsubscribePrivacy = subscribePrivacyState(state => this.setData(state));
    },
    detached() {
      if (this.unsubscribePrivacy) this.unsubscribePrivacy();
    }
  },
  methods: {
    noop() {},
    openPrivacyContract() {
      if (typeof wx.openPrivacyContract !== 'function') {
        wx.showToast({ title: '当前微信版本无法打开隐私指引', icon: 'none' });
        return;
      }
      wx.openPrivacyContract({
        fail: error => wx.showToast({ title: error.errMsg || '隐私指引打开失败', icon: 'none' })
      });
    },
    handleAgreePrivacyAuthorization() {
      settlePrivacyAuthorization('agree', 'privacy-agree-button');
    },
    handleDisagreePrivacyAuthorization() {
      settlePrivacyAuthorization('disagree');
    }
  }
});
