const content = {
  faq: {
    title: '帮助中心',
    sections: [
      { title: '如何参与抽奖', body: '打开活动详情后点击“参与抽奖”，满足活动参与条件后即可进入抽奖名单。' },
      { title: '如何查看开奖结果', body: '开奖后可在“我的记录”的中奖记录中查看结果；已授权订阅消息的用户会收到微信通知。' },
      { title: '如何领取奖品', body: '请按照活动详情中的兑奖说明操作，实物奖品可在收货地址中维护配送信息。' },
      { title: '如何发起抽奖', body: '选择抽奖模板，配置奖项、开奖方式和参与条件，完成测试后即可正式发布。' }
    ]
  },
  user: {
    title: '用户协议',
    sections: [
      { title: '服务说明', body: '本服务用于创建、参与和管理抽奖活动。用户应保证发布内容真实、合法，并按照已公布的活动规则履行奖品发放义务。' },
      { title: '账号与行为', body: '用户通过微信便捷登录使用服务，不得利用本服务实施欺诈、虚假宣传、侵害他人权益或其他违法违规行为。' },
      { title: '活动责任', body: '活动发起人负责奖品信息、参与条件、开奖规则及兑奖安排的准确性，并承担相应履约责任。' }
    ]
  },
  privacy: {
    title: '隐私政策',
    sections: [
      { title: '信息收集', body: '为完成登录、参与抽奖、中奖通知和奖品配送，服务会处理微信登录标识、活动记录、订阅授权状态及用户主动填写的收货信息。' },
      { title: '信息使用', body: '相关信息仅用于提供抽奖服务、展示个人记录、发送用户主动订阅的通知和完成奖品配送。' },
      { title: '信息保护', body: '服务采用会话鉴权、HTTPS 传输和访问控制保护用户信息，并按照业务需要和适用规则保存数据。' }
    ]
  }
};

Page({
  data: {
    title: '帮助中心',
    sections: content.faq.sections
  },
  onLoad(options = {}) {
    const page = content[options.section] || content.faq;
    this.setData(page);
    wx.setNavigationBarTitle({ title: page.title });
  }
});
