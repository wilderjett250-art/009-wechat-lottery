const { request, assetUrl } = require('../../utils/request');
const { requestWechatGroupProof } = require('../../utils/group-proof');
const { FALLBACK_METRICS, applyNavigationMetrics } = require('../../utils/navigation');
const { requirePrivacyAuthorization } = require('../../utils/privacy');
const { requestConfiguredLotterySubscription } = require('../../utils/subscribe');

const prizeTabs = ['奖品', '优惠券', '红包', '兑换码', '商城奖品'];
const drawTabs = [
  { key: 'time', title: '按时间开奖' },
  { key: 'people', title: '按人数开奖' },
  { key: 'instant', title: '即抽即中' }
];
const deliveryMethods = ['发起人发货', '中奖者到店领取', '系统自动发放'];

const templateOptions = [
  { key: 'new', title: '新样式', icon: '◉' },
  { key: 'wechat', title: '微信群抽奖', icon: '♙' },
  { key: 'annual', title: '年会抽奖', icon: '▦' },
  { key: 'official', title: '公众号抽奖', icon: '♙' },
  { key: 'redbook', title: '小红书抽奖', icon: '书' },
  { key: 'unlock', title: '按人数解锁奖品', icon: '▣' },
  { key: 'fun', title: '趣味抽奖', icon: '◆' },
  { key: 'homepage', title: '首页推广抽奖', icon: '▤' }
];

const styleOptions = [
  { key: 'wheel', title: '大转盘', icon: '转', tone: 'wheel' },
  { key: 'code', title: '抽码', icon: '码', tone: 'code' },
  { key: 'machine', title: '抽奖机', icon: '奖', tone: 'machine' },
  { key: 'draw', title: '抽签', icon: '签', tone: 'draw' }
];

const promotionItems = [
  { key: 'encourageShare', title: '鼓励参与者分享', linkText: '示例' },
  { key: 'platformRecommend', title: '允许平台向更多人推荐你的抽奖', linkText: '规则' },
  { key: 'hideShareButton', title: '参与人页面隐藏分享按钮', linkText: '示例' }
];

const conditionGroups = [
  {
    title: '参与后任务',
    items: [
      { key: 'assist', title: '参与后可助力增加助力值' }
    ]
  },
  {
    title: '完成参与条件，才能参与抽奖',
    items: [
      { key: 'groupOnly', title: '仅群成员可参与', linkText: '示例' },
      { key: 'fansOnly', title: '公众号粉丝可参与', linkText: '示例' },
      { key: 'review', title: '先审核再参与', linkText: '说明' },
      { key: 'wecom', title: '加企业微信后参与', linkText: '示例' },
      { key: 'region', title: '指定区域用户可参与', linkText: '说明' },
      { key: 'survey', title: '填写问卷后参与', linkText: '示例' },
      { key: 'task', title: '参与前完成指定任务', linkText: '示例' },
      { key: 'answer', title: '答题后参与', linkText: '示例' },
      { key: 'vote', title: '投票后参与', linkText: '示例' }
    ]
  }
];

const exclusiveConditionKeys = [
  'groupOnly',
  'fansOnly',
  'review',
  'wecom',
  'region',
  'survey',
  'task',
  'answer',
  'vote'
];

const compatibleConditionPairs = new Set([
  ['groupOnly', 'region'],
  ['groupOnly', 'survey'],
  ['groupOnly', 'answer'],
  ['fansOnly', 'region'],
  ['fansOnly', 'survey'],
  ['fansOnly', 'answer'],
  ['review', 'region'],
  ['wecom', 'region'],
  ['region', 'survey']
].map(pair => pair.sort().join(':')));

const conditionEditorTitles = {
  review: '设置审核内容',
  region: '设置指定区域',
  survey: '设置问卷',
  task: '设置参与任务',
  answer: '设置答题',
  vote: '设置投票'
};

function conditionsCompatible(left, right) {
  if (left === right) return true;
  return compatibleConditionPairs.has([left, right].sort().join(':'));
}

function activateCondition(values, key) {
  const next = { ...values };
  for (const activeKey of exclusiveConditionKeys) {
    if (next[activeKey] && !conditionsCompatible(activeKey, key)) next[activeKey] = false;
  }
  next[key] = true;
  return next;
}

const advancedItems = [
  { key: 'cleanDisplay', title: '纯净显示', desc: '抽奖传播过程无平台推荐信息' },
  { key: 'exclusiveLanding', title: '专属引流位', desc: '参与后、开奖后展示引流信息' },
  { key: 'analytics', title: '抽奖数据统计', desc: '可获取访问、分享等数据' },
  { key: 'blockHighRisk', title: '阻拦高风险用户参与', desc: '' },
  { key: 'comments', title: '留言', desc: '' },
  { key: 'futureSubscription', title: '邀请参与者订阅以后发起的抽奖', desc: '' },
  { key: 'recentWinnerBlock', title: '近期中奖者不可参与', desc: '' }
];

function todayPlus(days) {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function createPrize(index = 0) {
  return {
    clientId: `prize_${Date.now()}_${index}`,
    name: '',
    quantity: '1',
    type: '奖品',
    faceValue: '',
    image: '',
    deliveryMethod: '发起人发货',
    unlockParticipants: ''
  };
}

function buildPrizeTabs(active) {
  return prizeTabs.map(title => ({
    title,
    className: title === active ? 'active' : ''
  }));
}

function buildDrawTabs(active) {
  return drawTabs.map(item => ({
    ...item,
    className: item.key === active ? 'active' : ''
  }));
}

let runtimeCapabilities = {
  officialAccount: { configured: false, authorizationEnabled: false },
  wecom: { configured: false }
};

function capabilityAvailable(key, capabilities = runtimeCapabilities) {
  if (key === 'fansOnly') {
    return Boolean(capabilities.officialAccount?.configured || capabilities.officialAccount?.authorizationEnabled);
  }
  if (key === 'wecom') return Boolean(capabilities.wecom?.configured);
  return true;
}

function buildConditionGroups(values = {}, capabilities = runtimeCapabilities) {
  const selectedKeys = exclusiveConditionKeys.filter(key => Boolean(values[key]));
  return conditionGroups.map(group => {
    const items = group.items.filter(item => capabilityAvailable(item.key, capabilities)).map(item => ({
      ...item,
      checked: Boolean(values[item.key]),
      disabled: !values[item.key] && exclusiveConditionKeys.includes(item.key) &&
        selectedKeys.some(selectedKey => !conditionsCompatible(item.key, selectedKey))
    }));
    return { title: group.title, items };
  }).filter(group => group.items.length);
}

function buildToggleItems(items, values = {}) {
  return items.map(item => ({ ...item, checked: Boolean(values[item.key]) }));
}

function buildTemplateOptions(activeKey, capabilities = runtimeCapabilities) {
  return templateOptions
    .filter(item => item.key !== 'official' || capabilityAvailable('fansOnly', capabilities))
    .map(item => ({ ...item, active: item.key === activeKey }));
}

function mimeTypeFromPath(filePath = '') {
  const extension = String(filePath).split('.').pop().toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

Page({
  data: {
    navMetrics: FALLBACK_METRICS,
    templateKey: 'new',
    templateType: '新样式',
    templateOptions: buildTemplateOptions('new'),
    styleOptions,
    styleSelectorVisible: false,
    activePrizeIndex: 0,
    activePrize: createPrize(0),
    prizes: [createPrize(0)],
    prizeTypeTabs: buildPrizeTabs('奖品'),
    activeDrawMode: 'time',
    drawModeTabs: buildDrawTabs('time'),
    conditionValues: {},
    conditionGroups: buildConditionGroups(),
    conditionConfig: {
      reviewPrompt: '',
      taskText: '',
      answerQuestion: '',
      answerValue: '',
      voteQuestion: '',
      voteOptionA: '',
      voteOptionB: ''
    },
    moreExpanded: false,
    promotionValues: {},
    promotionItems: buildToggleItems(promotionItems),
    advancedEnabled: false,
    advancedValues: {},
    advancedItems: buildToggleItems(advancedItems),
    recentWinnerActivityIds: [],
    recentWinnerActivityTitles: [],
    commentSubscriptionAccepted: false,
    groupType: 'wechat',
    groupTypeLabel: '普通微信群',
    selectedEnterprise: null,
    capabilities: {
      officialAccount: { configured: false, name: '', username: '' },
      wecom: { configured: false, name: '' }
    },
    regionConfig: null,
    surveyQuestions: [{ id: 'question_1', title: '', required: true }],
    conditionEditor: { visible: false, key: '', title: '' },
    creatorAvatar: assetUrl('/assets/avatar-default.svg'),
    creatorName: '点击登录',
    form: {
      drawDate: todayPlus(1),
      drawTime: '20:00',
      drawParticipantTarget: '10',
      instantPerUserLimit: '1',
      instantParticipantLimit: '5',
      description: '',
      leadInfo: '',
      homePlacement: '',
      unlockByPeople: false,
      introImages: []
    },
    formErrors: {
      instantParticipantLimit: '',
      instantDeadline: ''
    },
    submitting: false,
    uploading: false
  },
  onLoad(options = {}) {
    applyNavigationMetrics(this);
    if (options.type) {
      const title = decodeURIComponent(options.type);
      const template = templateOptions.find(item => item.title === title);
      if (template) this.applyTemplatePreset(template.key);
    }
    this.loadCapabilities();
  },
  onShow() {
    wx.hideTabBar();
    wx.setNavigationBarTitle({ title: '发起抽奖' });
    wx.setNavigationBarColor({
      frontColor: '#000000',
      backgroundColor: '#ffffff'
    });
    this.applyCreator();
  },
  async loadCapabilities() {
    const capabilities = await request('/api/integrations/capabilities').catch(() => ({
      officialAccount: { configured: false, name: '', username: '' },
      wecom: { configured: false, name: '' },
      subscriptionTemplates: {}
    }));
    if (capabilities.subscriptionTemplates) {
      wx.setStorageSync('lotterySubscribeTemplateIds', capabilities.subscriptionTemplates);
    }
    runtimeCapabilities = capabilities;
    const officialAvailable = capabilityAvailable('fansOnly', capabilities);
    const wecomAvailable = capabilityAvailable('wecom', capabilities);
    const conditionValues = {
      ...this.data.conditionValues,
      fansOnly: officialAvailable ? Boolean(this.data.conditionValues.fansOnly) : false,
      wecom: wecomAvailable ? Boolean(this.data.conditionValues.wecom) : false
    };
    const templateKey = this.data.templateKey === 'official' && !officialAvailable
      ? 'new'
      : this.data.templateKey;
    this.setData({
      capabilities,
      templateKey,
      templateType: templateKey === 'new' && this.data.templateKey === 'official'
        ? '新样式'
        : this.data.templateType,
      templateOptions: buildTemplateOptions(templateKey, capabilities),
      conditionValues,
      conditionGroups: buildConditionGroups(conditionValues, capabilities)
    });
  },
  onUnload() {
    wx.showTabBar();
  },
  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/index/index' });
  },
  selectTemplate(event) {
    const templateKey = event.currentTarget.dataset.key;
    if (templateKey === 'new') {
      this.setData({ styleSelectorVisible: true });
      return;
    }
    if (templateKey === 'annual') {
      wx.navigateTo({ url: '/pages/annual-intro/annual-intro' });
      return;
    }
    wx.navigateTo({ url: `/pages/launch/launch?preset=${templateKey}&standalone=1` });
  },
  closeStyleSelector() {
    this.setData({ styleSelectorVisible: false });
  },
  chooseStyle(event) {
    const styleKey = event.currentTarget.dataset.key;
    this.setData({ styleSelectorVisible: false });
    wx.navigateTo({ url: `/pages/launch/launch?preset=new&standalone=1&style=${styleKey}` });
  },
  applyTemplatePreset(templateKey) {
    const template = templateOptions.find(item => item.key === templateKey) || templateOptions[0];
    let conditionValues = { ...this.data.conditionValues };
    const promotionValues = { ...this.data.promotionValues };
    let activeDrawMode = this.data.activeDrawMode;
    let unlockByPeople = this.data.form.unlockByPeople;
    let homePlacement = this.data.form.homePlacement;
    if (template.key === 'wechat') conditionValues = activateCondition(conditionValues, 'groupOnly');
    if (template.key === 'official') conditionValues = activateCondition(conditionValues, 'fansOnly');
    if (template.key === 'redbook') conditionValues = activateCondition(conditionValues, 'task');
    if (template.key === 'unlock') {
      activeDrawMode = 'people';
      unlockByPeople = true;
    }
    if (template.key === 'homepage') {
      promotionValues.platformRecommend = true;
      homePlacement = 'daily';
    }
    this.setData({
      templateKey: template.key,
      templateType: template.title,
      templateOptions: buildTemplateOptions(template.key),
      conditionValues,
      conditionGroups: buildConditionGroups(conditionValues),
      promotionValues,
      promotionItems: buildToggleItems(promotionItems, promotionValues),
      activeDrawMode,
      drawModeTabs: buildDrawTabs(activeDrawMode),
      'form.unlockByPeople': unlockByPeople,
      'form.homePlacement': homePlacement
    });
  },
  persistActivePrize() {
    const prizes = this.data.prizes.slice();
    prizes[this.data.activePrizeIndex] = { ...this.data.activePrize };
    return prizes;
  },
  selectPrize(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || !this.data.prizes[index]) return;
    const prizes = this.persistActivePrize();
    const activePrize = { ...prizes[index] };
    this.setData({
      prizes,
      activePrizeIndex: index,
      activePrize,
      prizeTypeTabs: buildPrizeTabs(activePrize.type)
    });
  },
  selectPrizeType(event) {
    const type = event.currentTarget.dataset.title;
    const deliveryMethod = ['优惠券', '红包', '兑换码'].includes(type)
      ? '系统自动发放'
      : this.data.activePrize.deliveryMethod;
    this.setData({
      'activePrize.type': type,
      'activePrize.deliveryMethod': deliveryMethod,
      prizeTypeTabs: buildPrizeTabs(type)
    });
  },
  onPrizeInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`activePrize.${field}`]: event.detail.value });
  },
  addPrize() {
    if (this.data.prizes.length >= 10) {
      wx.showToast({ title: '最多添加 10 个奖项', icon: 'none' });
      return;
    }
    const prizes = this.persistActivePrize();
    const activePrize = createPrize(prizes.length);
    prizes.push(activePrize);
    this.setData({
      prizes,
      activePrizeIndex: prizes.length - 1,
      activePrize,
      prizeTypeTabs: buildPrizeTabs(activePrize.type)
    });
  },
  removePrize(event) {
    if (this.data.prizes.length === 1) {
      wx.showToast({ title: '至少保留一个奖项', icon: 'none' });
      return;
    }
    const removeIndex = Number(event.currentTarget.dataset.index);
    const prizes = this.persistActivePrize().filter((item, index) => index !== removeIndex);
    prizes[prizes.length - 1] = { ...prizes[prizes.length - 1], unlockParticipants: '' };
    const activePrizeIndex = Math.min(removeIndex, prizes.length - 1);
    const activePrize = { ...prizes[activePrizeIndex] };
    this.setData({
      prizes,
      activePrizeIndex,
      activePrize,
      prizeTypeTabs: buildPrizeTabs(activePrize.type)
    });
  },
  chooseDeliveryMethod() {
    wx.showActionSheet({
      itemList: deliveryMethods,
      success: result => {
        this.setData({ 'activePrize.deliveryMethod': deliveryMethods[result.tapIndex] });
      }
    });
  },
  selectDrawMode(event) {
    const activeDrawMode = event.currentTarget.dataset.key;
    const unlockByPeople = activeDrawMode === 'instant' ? false : Boolean(this.data.form.unlockByPeople);
    this.setData({
      activeDrawMode,
      drawModeTabs: buildDrawTabs(activeDrawMode),
      'form.unlockByPeople': unlockByPeople,
      formErrors: { instantParticipantLimit: '', instantDeadline: '' }
    });
  },
  onInput(event) {
    const field = event.currentTarget.dataset.field;
    const updates = { [`form.${field}`]: event.detail.value };
    if (field === 'instantParticipantLimit') updates['formErrors.instantParticipantLimit'] = '';
    this.setData(updates);
  },
  onDateChange(event) {
    this.setData({ 'form.drawDate': event.detail.value, 'formErrors.instantDeadline': '' });
  },
  onTimeChange(event) {
    this.setData({ 'form.drawTime': event.detail.value, 'formErrors.instantDeadline': '' });
  },
  chooseInstantPerUserLimit() {
    const options = ['每人限抽 1 次', '每人限抽 2 次', '每人限抽 3 次', '每人限抽 4 次', '每人限抽 5 次'];
    wx.showActionSheet({
      itemList: options,
      success: result => this.setData({ 'form.instantPerUserLimit': String(result.tapIndex + 1) })
    });
  },
  toggleUnlock(event) {
    this.setData({ 'form.unlockByPeople': event.detail.value });
  },
  toggleMoreFeatures() {
    this.setData({ moreExpanded: !this.data.moreExpanded });
  },
  togglePromotion(event) {
    const key = event.currentTarget.dataset.key;
    const promotionValues = { ...this.data.promotionValues, [key]: !this.data.promotionValues[key] };
    this.setData({
      promotionValues,
      promotionItems: buildToggleItems(promotionItems, promotionValues),
      'form.homePlacement': key === 'platformRecommend' && promotionValues[key]
        ? (this.data.form.homePlacement || 'daily')
        : this.data.form.homePlacement
    });
  },
  toggleAdvanced() {
    this.setData({ advancedEnabled: !this.data.advancedEnabled });
  },
  async toggleAdvancedOption(event) {
    const key = event.currentTarget.dataset.key;
    const enabling = !this.data.advancedValues[key];
    if (key === 'recentWinnerBlock' && enabling) {
      this.openRecentWinnerPicker();
      return;
    }
    if (key === 'comments' && enabling) {
      const subscription = await requestConfiguredLotterySubscription('comment');
      if (subscription.status === 'not_configured') {
        wx.showModal({
          title: '留言通知模板待配置',
          content: '留言功能可以正常使用。配置“留言回复通知”一次性订阅模板后，这里会直接弹出微信授权窗口。',
          showCancel: false
        });
      } else if (!subscription.accepted) {
        wx.showToast({ title: '未开启微信留言通知', icon: 'none' });
      }
      this.setData({ commentSubscriptionAccepted: subscription.accepted });
    }
    const advancedValues = { ...this.data.advancedValues, [key]: enabling };
    const extraState = key === 'recentWinnerBlock' && !enabling
      ? { recentWinnerActivityIds: [], recentWinnerActivityTitles: [] }
      : {};
    this.setData({
      advancedValues,
      advancedItems: buildToggleItems(advancedItems, advancedValues),
      ...extraState
    });
  },
  async openRecentWinnerPicker() {
    try {
      await this.ensureUserSession();
    } catch (error) {
      return;
    }
    wx.navigateTo({
      url: '/pages/recent-winner-range/recent-winner-range',
      events: {
        recentWinnerSelection: result => {
          const ids = Array.isArray(result?.ids) ? result.ids : [];
          const titles = Array.isArray(result?.titles) ? result.titles : [];
          const advancedValues = { ...this.data.advancedValues, recentWinnerBlock: ids.length > 0 };
          this.setData({
            advancedValues,
            advancedItems: buildToggleItems(advancedItems, advancedValues),
            recentWinnerActivityIds: ids,
            recentWinnerActivityTitles: titles
          });
        }
      },
      success: navigation => {
        navigation.eventChannel.emit('initialSelection', { ids: this.data.recentWinnerActivityIds });
      }
    });
  },
  onConditionConfigInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [`conditionConfig.${field}`]: event.detail.value });
  },
  openConditionEditor(event) {
    const key = event.currentTarget.dataset.key;
    if (!conditionEditorTitles[key]) return;
    this.setData({
      conditionEditor: {
        visible: true,
        key,
        title: conditionEditorTitles[key]
      }
    });
  },
  closeConditionEditor() {
    this.setData({ conditionEditor: { visible: false, key: '', title: '' } });
  },
  noop() {},
  addSurveyQuestion() {
    if (this.data.surveyQuestions.length >= 5) {
      wx.showToast({ title: '最多设置 5 个问题', icon: 'none' });
      return;
    }
    this.setData({
      surveyQuestions: this.data.surveyQuestions.concat({
        id: `question_${Date.now()}`,
        title: '',
        required: true
      })
    });
  },
  removeSurveyQuestion(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || this.data.surveyQuestions.length <= 1) return;
    this.setData({ surveyQuestions: this.data.surveyQuestions.filter((item, itemIndex) => itemIndex !== index) });
  },
  showOfficialAccountConfig() {
    wx.navigateTo({
      url: '/pages/official-account/official-account',
      events: {
        officialAccountSelected: account => {
          runtimeCapabilities = {
            ...this.data.capabilities,
            officialAccount: {
              configured: true,
              authorizationEnabled: Boolean(this.data.capabilities.officialAccount?.authorizationEnabled),
              appid: account.appid || account.key || '',
              name: account.name,
              username: account.username || ''
            }
          };
          this.setData({
            capabilities: runtimeCapabilities,
            templateOptions: buildTemplateOptions(this.data.templateKey)
          });
        },
        officialAccountUnset: () => {
          runtimeCapabilities = {
            ...this.data.capabilities,
            officialAccount: {
              configured: false,
              authorizationEnabled: Boolean(this.data.capabilities.officialAccount?.authorizationEnabled),
              appid: '',
              name: '',
              username: ''
            }
          };
          const conditionValues = { ...this.data.conditionValues, fansOnly: false };
          this.setData({
            conditionValues,
            conditionGroups: buildConditionGroups(conditionValues),
            capabilities: runtimeCapabilities,
            templateOptions: buildTemplateOptions(this.data.templateKey)
          });
        }
      }
    });
  },
  showWecomConfig() {
    const wecom = this.data.capabilities.wecom;
    wx.showModal({
      title: '选择所在的企业',
      content: wecom.configured
        ? `当前企业：${wecom.name}`
        : '暂无可用企业。请先在运营后台配置企业微信客户联系能力。',
      showCancel: false,
      confirmText: '知道了'
    });
  },
  applyCreator() {
    const profile = getApp().globalData.user || wx.getStorageSync('lotteryProfile') || {};
    this.setData({
      creatorName: profile.nickname || '点击登录',
      creatorAvatar: assetUrl(profile.avatar || '/assets/avatar-default.svg')
    });
  },
  ensureUserSession() {
    const token = wx.getStorageSync('lotteryToken');
    const profile = getApp().globalData.user || wx.getStorageSync('lotteryProfile');
    if (token && profile?.profileCompleted === true) return Promise.resolve(profile);
    return new Promise((resolve, reject) => {
      wx.showModal({
        title: '请先完成微信登录',
        content: '前往“我的”设置头像和昵称后，即可创建并管理真实抽奖。',
        confirmText: '去登录',
        success: result => {
          if (result.confirm) wx.switchTab({ url: '/pages/profile/profile' });
          reject(new Error('请先完成微信登录'));
        },
        fail: () => reject(new Error('请先完成微信登录'))
      });
    });
  },
  goLogin() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },
  async uploadImage(file) {
    if (Number(file.size || 0) > 5 * 1024 * 1024) throw new Error('图片大小不能超过 5MB');
    await this.ensureUserSession();
    const fileSystem = wx.getFileSystemManager();
    const base64 = await new Promise((resolve, reject) => {
      fileSystem.readFile({
        filePath: file.tempFilePath,
        encoding: 'base64',
        success: result => resolve(result.data),
        fail: error => reject(new Error(error.errMsg || '图片读取失败'))
      });
    });
    const uploaded = await request('/api/uploads/image', {
      method: 'POST',
      data: {
        base64,
        mimeType: mimeTypeFromPath(file.tempFilePath)
      }
    });
    return uploaded.url;
  },
  async chooseImages(count = 1) {
    await requirePrivacyAuthorization();
    const result = await new Promise((resolve, reject) => {
      wx.chooseMedia({
        count,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        sizeType: ['compressed'],
        success: resolve,
        fail: error => {
          if (/cancel/i.test(error.errMsg || '')) return resolve({ tempFiles: [] });
          reject(new Error(error.errMsg || '图片选择失败'));
        }
      });
    });
    return result.tempFiles || [];
  },
  async replaceImage() {
    if (this.data.uploading) return;
    try {
      const files = await this.chooseImages(1);
      if (!files.length) return;
      this.setData({ uploading: true });
      wx.showLoading({ title: '上传中' });
      const url = await this.uploadImage(files[0]);
      this.setData({ 'activePrize.image': assetUrl(url) });
      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '图片上传失败', icon: 'none' });
    } finally {
      this.setData({ uploading: false });
    }
  },
  async addIntroImages() {
    const remaining = 9 - this.data.form.introImages.length;
    if (remaining < 1 || this.data.uploading) return;
    try {
      const files = await this.chooseImages(Math.min(remaining, 9));
      if (!files.length) return;
      this.setData({ uploading: true });
      wx.showLoading({ title: '上传中' });
      const urls = [];
      for (const file of files) urls.push(assetUrl(await this.uploadImage(file)));
      this.setData({ 'form.introImages': this.data.form.introImages.concat(urls) });
      wx.hideLoading();
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '图片上传失败', icon: 'none' });
    } finally {
      this.setData({ uploading: false });
    }
  },
  removeIntroImage(event) {
    const index = Number(event.currentTarget.dataset.index);
    this.setData({
      'form.introImages': this.data.form.introImages.filter((item, itemIndex) => itemIndex !== index)
    });
  },
  toggleCondition(event) {
    const key = event.currentTarget.dataset.key;
    const enabling = !this.data.conditionValues[key];
    const disabled = event.currentTarget.dataset.disabled === true || event.currentTarget.dataset.disabled === 'true';
    if (enabling && disabled) {
      wx.showToast({ title: '不能与已选条件同时使用', icon: 'none' });
      return;
    }
    const conditionValues = enabling
      ? activateCondition(this.data.conditionValues, key)
      : { ...this.data.conditionValues, [key]: false };
    this.setData({
      conditionValues,
      conditionGroups: buildConditionGroups(conditionValues)
    });
  },
  async chooseRegion() {
    if (!wx.chooseLocation) {
      wx.showToast({ title: '当前环境不支持位置选择', icon: 'none' });
      return;
    }
    try {
      await requirePrivacyAuthorization();
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
      return;
    }
    wx.chooseLocation({
      success: result => {
        this.setData({
          regionConfig: {
            name: result.name || result.address || '指定区域',
            latitude: result.latitude,
            longitude: result.longitude,
            radiusMeters: this.data.regionConfig?.radiusMeters || 1000
          }
        });
      },
      fail: error => {
        if (!/cancel/i.test(error.errMsg || '')) {
          wx.showToast({ title: '位置选择失败', icon: 'none' });
        }
      }
    });
  },
  onRegionRadiusInput(event) {
    const radiusMeters = String(event.detail.value || '').replace(/\D/g, '').slice(0, 5);
    this.setData({
      regionConfig: {
        ...(this.data.regionConfig || {}),
        radiusMeters
      }
    });
  },
  onSurveyQuestionInput(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (!Number.isInteger(index) || !this.data.surveyQuestions[index]) return;
    this.setData({ [`surveyQuestions[${index}].title`]: event.detail.value });
  },
  chooseGroupType() {
    wx.showActionSheet({
      itemList: ['普通微信群', '企业微信客户群'],
      success: async result => {
        const groupType = result.tapIndex === 1 ? 'wecom' : 'wechat';
        if (groupType === 'wecom' && !this.data.capabilities.wecom.configured) {
          wx.showModal({
            title: '企业微信尚未绑定',
            content: '请先配置企业微信客户联系凭据，并在运营后台同步客户群。',
            showCancel: false,
            confirmText: '知道了'
          });
          return;
        }
        this.setData({
          groupType,
          groupTypeLabel: groupType === 'wecom' ? '企业微信客户群' : '普通微信群',
          selectedEnterprise: groupType === 'wecom' ? this.data.selectedEnterprise : null
        });
        if (groupType === 'wecom' && !this.data.selectedEnterprise) await this.selectEnterprise();
      }
    });
  },
  async selectEnterprise() {
    try {
      await this.ensureUserSession();
      wx.showLoading({ title: '读取客户群' });
      const groups = await request('/api/integrations/wecom/groups');
      wx.hideLoading();
      if (!groups.length) {
        wx.showModal({
          title: '暂无可用客户群',
          content: '请先在运营后台“微信能力”中同步企业微信客户群。',
          showCancel: false,
          confirmText: '知道了'
        });
        return;
      }
      wx.showActionSheet({
        itemList: groups.map(item => `${item.name}（${item.memberCount}人）`),
        success: result => this.setData({ selectedEnterprise: groups[result.tapIndex] })
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '客户群读取失败', icon: 'none' });
    }
  },
  openGuide(event) {
    const title = event.currentTarget.dataset.title || '使用说明';
    const guides = {
      '案例玩法': '填写奖项、开奖规则和参与条件后，可以先发起测试确认页面，再正式发布。',
      '开奖方式介绍': '按时间开奖会在设定时间自动开奖；按人数开奖会在人数达标后开奖；即抽即中会在用户参与时立即判断结果。',
      '查看示例': '建议写清活动规则、兑奖方式、有效期和发放安排。',
      '示例': '开启后，参与者需要完成对应条件才能进入抽奖名单。',
      '说明': '开启前请确认对应能力已在运营后台配置。'
    };
    wx.showModal({ title, content: guides[title] || guides['说明'], showCancel: false, confirmText: '知道了' });
  },
  async submit(event) {
    if (this.data.submitting || this.data.uploading) return;
    const status = event.currentTarget.dataset.status || 'live';
    const form = this.data.form;
    const prizes = this.persistActivePrize().map(item => ({
      ...item,
      name: String(item.name || '').trim(),
      quantity: Number(item.quantity || 0),
      unlockParticipants: Number(item.unlockParticipants || 0)
    }));
    const invalidPrize = prizes.find(item => !item.name || !Number.isInteger(item.quantity) || item.quantity < 1);
    if (invalidPrize) {
      wx.showToast({ title: invalidPrize.name ? '请输入有效的奖品份数' : '请完整填写奖品名称', icon: 'none' });
      return;
    }
    const invalidFaceValue = prizes.find(item =>
      ['优惠券', '红包'].includes(item.type) &&
      (!Number.isFinite(Number(item.faceValue)) || Number(item.faceValue) <= 0)
    );
    if (invalidFaceValue) {
      wx.showToast({ title: `请填写${invalidFaceValue.type}面额`, icon: 'none' });
      return;
    }

    const drawParticipantTarget = Number(form.drawParticipantTarget || 0);
    if (this.data.activeDrawMode === 'people' &&
      (!Number.isInteger(drawParticipantTarget) || drawParticipantTarget < 1)) {
      wx.showToast({ title: '请输入有效的开奖人数', icon: 'none' });
      return;
    }
    if (form.unlockByPeople) {
      if (prizes.length < 2) {
        wx.showToast({ title: '请至少添加两个奖项', icon: 'none' });
        return;
      }
      const thresholds = prizes.slice(0, -1).map(item => Number(item.unlockParticipants || 0));
      const invalidThresholdIndex = thresholds.findIndex(value => !Number.isInteger(value) || value < 1);
      if (invalidThresholdIndex >= 0) {
        this.setData({
          activePrizeIndex: invalidThresholdIndex,
          activePrize: { ...prizes[invalidThresholdIndex] }
        });
        wx.showToast({ title: '请填写奖品解锁人数', icon: 'none' });
        return;
      }
      if (thresholds.some((value, index) => index > 0 && value >= thresholds[index - 1])) {
        wx.showToast({ title: '高等级奖项解锁人数需依次更高', icon: 'none' });
        return;
      }
      if (this.data.activeDrawMode === 'people' && thresholds.some(value => value > drawParticipantTarget)) {
        wx.showToast({ title: '解锁人数不能超过开奖人数', icon: 'none' });
        return;
      }
      prizes[prizes.length - 1].unlockParticipants = 0;
    } else {
      prizes.forEach(item => { item.unlockParticipants = 0; });
    }
    const instantPerUserLimit = Number(form.instantPerUserLimit || 0);
    const instantParticipantLimit = Number(form.instantParticipantLimit || 0);
    if (this.data.activeDrawMode === 'instant') {
      if (!Number.isInteger(instantPerUserLimit) || instantPerUserLimit < 1 || instantPerUserLimit > 5) {
        wx.showToast({ title: '请选择单人参与次数', icon: 'none' });
        return;
      }
      if (!Number.isInteger(instantParticipantLimit) || instantParticipantLimit < 5) {
        this.setData({ 'formErrors.instantParticipantLimit': '！请填写人数上限（至少 5 人）' });
        return;
      }
      const prizeCount = prizes.reduce((sum, item) => sum + item.quantity, 0);
      if (instantParticipantLimit * instantPerUserLimit < prizeCount) {
        this.setData({ 'formErrors.instantParticipantLimit': '！参与次数容量不能少于奖品总份数' });
        return;
      }
    }
    if (this.data.conditionValues.fansOnly && !this.data.capabilities.officialAccount.configured) {
      wx.showToast({ title: '请先配置参与公众号', icon: 'none' });
      return;
    }
    if (this.data.conditionValues.wecom && !this.data.capabilities.wecom.configured) {
      wx.showToast({ title: '请先配置所在企业', icon: 'none' });
      return;
    }
    if (this.data.conditionValues.review && !String(this.data.conditionConfig.reviewPrompt || '').trim()) {
      wx.showToast({ title: '请设置审核内容', icon: 'none' });
      return;
    }
    if (this.data.conditionValues.region) {
      const region = this.data.regionConfig;
      const radius = Number(region?.radiusMeters || 0);
      if (!region || !Number.isFinite(radius) || radius < 100 || radius > 50000) {
        wx.showToast({ title: '请设置有效参与区域和范围', icon: 'none' });
        return;
      }
    }
    if (this.data.conditionValues.survey &&
      !this.data.surveyQuestions.some(item => String(item.title || '').trim())) {
      wx.showToast({ title: '请填写问卷问题', icon: 'none' });
      return;
    }
    const conditionConfig = this.data.conditionConfig;
    if (this.data.conditionValues.task && !String(conditionConfig.taskText || '').trim()) {
      wx.showToast({ title: '请填写参与前任务', icon: 'none' });
      return;
    }
    if (this.data.conditionValues.answer &&
      (!String(conditionConfig.answerQuestion || '').trim() || !String(conditionConfig.answerValue || '').trim())) {
      wx.showToast({ title: '请填写问题和正确答案', icon: 'none' });
      return;
    }
    if (this.data.conditionValues.vote &&
      (!String(conditionConfig.voteQuestion || '').trim() ||
        !String(conditionConfig.voteOptionA || '').trim() ||
        !String(conditionConfig.voteOptionB || '').trim())) {
      wx.showToast({ title: '请完整填写投票题目和选项', icon: 'none' });
      return;
    }

    const drawDate = new Date(`${form.drawDate}T${form.drawTime}:00+08:00`);
    if (Number.isNaN(drawDate.getTime())) {
      wx.showToast({ title: '请选择开奖时间', icon: 'none' });
      return;
    }
    if (drawDate.getTime() <= Date.now()) {
      if (this.data.activeDrawMode === 'instant') {
        this.setData({ 'formErrors.instantDeadline': '！请设置晚于当前时间的截止时间' });
      } else {
        wx.showToast({ title: '开奖时间不能早于现在', icon: 'none' });
      }
      return;
    }
    try {
      await this.ensureUserSession();
      this.applyCreator();
    } catch (error) {
      wx.showToast({ title: error.message || '登录失败', icon: 'none' });
      return;
    }

    let groupProof = '';
    if (this.data.conditionValues.groupOnly) {
      if (this.data.groupType === 'wecom') {
        if (!this.data.selectedEnterprise) {
          wx.showToast({ title: '请选择企业微信客户群', icon: 'none' });
          return;
        }
      } else {
        wx.showLoading({ title: '校验微信群' });
        try {
          groupProof = await requestWechatGroupProof();
        } catch (error) {
          wx.hideLoading();
          wx.showModal({
            title: '无法绑定微信群',
            content: error.message || '请从目标微信群重新打开小程序后再发起抽奖。',
            showCancel: false,
            confirmText: '知道了'
          });
          return;
        }
        wx.hideLoading();
      }
    }

    this.setData({ submitting: true, prizes });
    wx.showLoading({ title: status === 'draft' ? '发起测试中' : '发起抽奖中' });
    try {
      const activity = await request('/api/activities', {
        method: 'POST',
        data: {
          prizes: prizes.map(item => ({
            name: item.name,
            quantity: item.quantity,
            type: item.type,
            faceValue: Number(item.faceValue || 0),
            image: item.image || '/assets/lottery-ribbon.svg',
            deliveryMethod: item.deliveryMethod,
            unlockParticipants: item.unlockParticipants
          })),
          templateType: this.data.templateType,
          homePlacement: form.homePlacement,
          promotion: this.data.promotionValues,
          advanced: {
            enabled: this.data.advancedEnabled,
            ...this.data.advancedValues,
            recentWinnerDays: 30,
            recentWinnerActivityIds: this.data.recentWinnerActivityIds
          },
          drawMode: this.data.activeDrawMode,
          drawParticipantTarget,
          instantPerUserLimit,
          instantParticipantLimit,
          drawAt: drawDate.toISOString(),
          description: String(form.description || '').trim(),
          leadInfo: String(form.leadInfo || '').trim(),
          introImages: form.introImages,
          unlockByPeople: Boolean(form.unlockByPeople),
          conditions: {
            ...this.data.conditionValues,
            officialAccountAppId: this.data.conditionValues.fansOnly ? (this.data.capabilities.officialAccount.appid || '') : '',
            officialAccountName: this.data.conditionValues.fansOnly ? (this.data.capabilities.officialAccount.name || '') : '',
            officialAccountUsername: this.data.conditionValues.fansOnly ? (this.data.capabilities.officialAccount.username || '') : '',
            groupType: this.data.groupType,
            enterpriseId: this.data.selectedEnterprise?.id || '',
            enterpriseName: this.data.selectedEnterprise?.name || '',
            regionConfig: this.data.conditionValues.region ? {
              ...this.data.regionConfig,
              radiusMeters: Number(this.data.regionConfig.radiusMeters)
            } : null,
            surveyQuestions: this.data.conditionValues.survey
              ? this.data.surveyQuestions.map(item => ({
                  ...item,
                  title: String(item.title || '').trim()
                })).filter(item => item.title)
              : [],
            reviewPrompt: this.data.conditionValues.review ? String(conditionConfig.reviewPrompt || '').trim() : '',
            taskText: this.data.conditionValues.task ? String(conditionConfig.taskText || '').trim() : '',
            answerQuestion: this.data.conditionValues.answer ? String(conditionConfig.answerQuestion || '').trim() : '',
            answerValue: this.data.conditionValues.answer ? String(conditionConfig.answerValue || '').trim() : '',
            voteQuestion: this.data.conditionValues.vote ? String(conditionConfig.voteQuestion || '').trim() : '',
            voteOptions: this.data.conditionValues.vote
              ? [conditionConfig.voteOptionA, conditionConfig.voteOptionB].map(item => String(item || '').trim()).filter(Boolean)
              : []
          },
          groupProof,
          status
        }
      });
      let commentNotificationSaved = true;
      if (this.data.advancedValues.comments && this.data.commentSubscriptionAccepted) {
        try {
          await request('/api/me/subscriptions', {
            method: 'POST',
            data: { type: 'comment', activityId: activity.id }
          });
        } catch (error) {
          commentNotificationSaved = false;
        }
      }
      wx.hideLoading();
      wx.showToast({
        title: commentNotificationSaved
          ? (status === 'draft' ? '测试已创建' : '抽奖已发布')
          : '抽奖已发布，留言通知登记失败',
        icon: commentNotificationSaved ? 'success' : 'none'
      });
      setTimeout(() => {
        wx.navigateTo({ url: `/pages/detail/detail?id=${activity.id}` });
      }, 500);
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '发起失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  }
});
