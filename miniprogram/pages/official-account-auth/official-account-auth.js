Page({
  data: {
    url: ''
  },
  onLoad(options) {
    const url = decodeURIComponent(String(options.url || ''));
    if (!/^https:\/\//.test(url)) {
      wx.showModal({
        title: '授权地址无效',
        content: '请返回上一页重新发起公众号授权。',
        showCancel: false,
        success: () => wx.navigateBack()
      });
      return;
    }
    this.setData({ url });
  }
});
