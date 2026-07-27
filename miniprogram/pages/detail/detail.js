const { request, assetUrl, uploadFile } = require('../../utils/request');
const { requestConfiguredLotterySubscription, requestConfiguredLotterySubscriptions, subscriptionMessage } = require('../../utils/subscribe');
const { requestWechatGroupProof } = require('../../utils/group-proof');
const { FALLBACK_METRICS, applyNavigationMetrics } = require('../../utils/navigation');
const { requirePrivacyAuthorization } = require('../../utils/privacy');

const ACTIVITY_REMINDER_STORAGE_KEY = 'lotteryActivityRemindersV2';
const RECENT_ACTIVITY_STORAGE_KEY = 'lotteryRecentActivitiesV1';
const PROFILE_STORAGE_KEY = 'lotteryProfile';

function readStorageObject(key) {
  try {
    return wx.getStorageSync(key) || {};
  } catch (error) {
    return {};
  }
}

function writeStorageObject(key, value) {
  try {
    wx.setStorageSync(key, value);
  } catch (error) {
    wx.showToast({ title: '本地状态保存失败', icon: 'none' });
  }
}

function saveRecentActivity(activity) {
  try {
    const recent = wx.getStorageSync(RECENT_ACTIVITY_STORAGE_KEY);
    const items = Array.isArray(recent) ? recent : [];
    const record = {
      id: activity.id,
      title: activity.title,
      image: activity.image,
      drawAt: activity.drawAt,
      status: activity.status,
      metrics: activity.metrics,
      viewedAt: new Date().toISOString()
    };
    wx.setStorageSync(
      RECENT_ACTIVITY_STORAGE_KEY,
      [record, ...items.filter(item => item.id !== record.id)].slice(0, 20)
    );
  } catch (error) {
    // Browsing history is non-critical and must not block the activity page.
  }
}

function formatDate(value) {
  const date = new Date(value);
  const pad = number => String(number).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildParticipantTicker(participants = []) {
  return participants
    .slice(0, 6)
    .map(participant => `${participant.nickname || '用户'}参与了抽奖`)
    .join('　　');
}

function currentProfile() {
  return getApp().globalData.user || wx.getStorageSync(PROFILE_STORAGE_KEY);
}

function saveProfile(profile) {
  if (!profile) return;
  wx.setStorageSync(PROFILE_STORAGE_KEY, profile);
  getApp().globalData.user = profile;
}

function viewerKey() {
  const key = 'lotteryViewerKeyV1';
  let value = wx.getStorageSync(key);
  if (!value) {
    value = `viewer_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    wx.setStorageSync(key, value);
  }
  return value;
}

function checkInViewState(activity, joined) {
  const task = activity?.conditions?.checkInTask;
  const progress = activity?.checkInProgress || { status: 'not_started', bonusWeight: 1 };
  if (!activity?.conditions?.checkIn || !task) {
    return { checkInActionText: '', checkInActionDisabled: true, checkInCountdownText: '' };
  }
  if (!joined) {
    return {
      checkInActionText: '参与后可开始',
      checkInActionDisabled: true,
      checkInCountdownText: '先加入抽奖名单，再完成本任务领取额外权重。'
    };
  }
  if (progress.status === 'completed') {
    return {
      checkInActionText: '打卡已完成',
      checkInActionDisabled: true,
      checkInCountdownText: `已获得 ${Math.max(1, Number(progress.bonusWeight || 1))} 倍抽奖权重。`
    };
  }
  if (progress.status === 'started') {
    const remainingSeconds = Math.max(0, Math.ceil((Date.parse(progress.readyAt || '') - Date.now()) / 1000));
    if (remainingSeconds > 0) {
      return {
        checkInActionText: '打卡进行中',
        checkInActionDisabled: true,
        checkInCountdownText: `计时已开始，${remainingSeconds} 秒后可完成打卡。`
      };
    }
    return {
      checkInActionText: '完成打卡',
      checkInActionDisabled: false,
      checkInCountdownText: '已达到设定时长，完成后立即获得权重奖励。'
    };
  }
  return {
    checkInActionText: '开始打卡',
    checkInActionDisabled: false,
    checkInCountdownText: `完成后可获得额外抽奖权重，需计时 ${task.durationSeconds} 秒。`
  };
}

Page({
  data: {
    navMetrics: FALLBACK_METRICS,
    activity: null,
    joined: false,
    joinStatus: 'none',
    joinButtonText: '参与抽奖',
    joinButtonDisabled: false,
    surveyAnswers: {},
    taskCompleted: false,
    taskActionText: '开始任务',
    taskProofUploaded: false,
    taskProofNote: '',
    checkInActionText: '',
    checkInActionDisabled: true,
    checkInCountdownText: '',
    answerText: '',
    voteAnswer: '',
    commentText: '',
    assistTargetId: '',
    assisted: false,
    drawTime: '',
    participantTicker: '',
    reminded: false,
    subscribedToCreator: false
  },
  onLoad(options) {
    applyNavigationMetrics(this);
    this.activityId = options.id;
    this.assistTargetId = String(options.assist || '');
    this.setData({ assistTargetId: this.assistTargetId });
    if (wx.showShareMenu) {
      wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] });
    }
  },
  onShareAppMessage() {
    request(`/api/activities/${this.activityId}/share`, {
      method: 'POST',
      data: { channel: 'wechat' }
    }).catch(() => {});
    const participantId = this.data.activity?.participantId || '';
    const assistQuery = this.data.activity?.conditions?.assist && participantId
      ? `&assist=${encodeURIComponent(participantId)}`
      : '';
    return {
      title: this.data.activity?.shareTitle || this.data.activity?.title || '邀请你参与抽奖',
      path: `/pages/detail/detail?id=${this.activityId}${assistQuery}`
    };
  },
  onShow() {
    this.loadActivity();
  },
  onHide() {
    this.clearCheckInTimer();
  },
  onUnload() {
    this.clearCheckInTimer();
  },
  clearCheckInTimer() {
    if (this.checkInTimer) {
      clearInterval(this.checkInTimer);
      this.checkInTimer = null;
    }
  },
  syncCheckInTimer() {
    this.clearCheckInTimer();
    const progress = this.data.activity?.checkInProgress;
    if (progress?.status !== 'started' || Date.parse(progress.readyAt || '') <= Date.now()) return;
    this.checkInTimer = setInterval(() => {
      const state = checkInViewState(this.data.activity, this.data.joined);
      this.setData(state);
      if (!state.checkInActionDisabled) this.clearCheckInTimer();
    }, 1000);
  },
  async loadActivity() {
    try {
      const activity = await request(`/api/activities/${this.activityId}`);
      activity.image = assetUrl(activity.image);
      activity.prizes = (activity.prizes || []).map(prize => ({ ...prize, image: assetUrl(prize.image) }));
      activity.introImages = (activity.introImages || []).map(assetUrl);
      const user = currentProfile();
      const joined = Boolean(activity.joined);
      const joinStatus = activity.joinStatus || (joined ? 'joined' : 'none');
      const isInstant = activity.drawMode === 'instant';
      const instantAttemptsRemaining = Math.max(0, Number(activity.instantAttemptsRemaining || 0));
      const instantCanRetry = isInstant && activity.status === 'live' && instantAttemptsRemaining > 0;
      let joinButtonText = {
        joined: '已参与抽奖',
        pending: '审核中',
        rejected: '重新申请'
      }[joinStatus] || '参与抽奖';
      if (isInstant && joinStatus !== 'pending' && joinStatus !== 'rejected') {
        if (activity.status !== 'live') joinButtonText = '抽奖已结束';
        else if (!instantAttemptsRemaining) joinButtonText = '参与次数已用完';
        else joinButtonText = joined ? `继续抽奖（剩余 ${instantAttemptsRemaining} 次）` : '立即抽奖';
      }
      const drawRuleText = isInstant
        ? `${formatDate(activity.drawAt)} 截止`
        : activity.drawMode === 'people'
          ? `达到 ${activity.drawParticipantTarget} 人自动开奖，未达到则 ${formatDate(activity.drawAt)} 开奖`
          : `${formatDate(activity.drawAt)} 到时自动开奖`;
      const reminders = readStorageObject(ACTIVITY_REMINDER_STORAGE_KEY);
      const hasSession = Boolean(wx.getStorageSync('lotteryToken'));
      const taskProgress = activity.taskProgress || { status: 'not_started' };
      const taskStatus = taskProgress.status || 'not_started';
      const taskBlocksJoin = Boolean(activity.conditions?.task && taskStatus !== 'completed');
      const taskActionText = taskStatus === 'completed'
        ? '任务已审核通过'
        : (taskStatus === 'pending'
          ? '凭证审核中'
          : (taskStatus === 'rejected'
            ? '重新提交凭证'
            : (taskStatus === 'started'
              ? (activity.conditions?.taskProofRequired ? '提交完成凭证' : '确认任务完成')
              : '开始任务')));
      if (taskBlocksJoin && joinStatus === 'none') {
        joinButtonText = taskStatus === 'pending'
          ? '任务审核中'
          : (taskStatus === 'rejected' ? '请重新提交凭证' : '完成任务后参与');
      }
      this.setData({
        activity,
        joined,
        joinStatus,
        joinButtonText,
        joinButtonDisabled: taskBlocksJoin || joinStatus === 'pending' || (joined && !instantCanRetry) || activity.status !== 'live',
        drawTime: formatDate(activity.drawAt),
        drawRuleText,
        participantTicker: buildParticipantTicker(activity.participants),
        reminded: hasSession ? Boolean(activity.reminderEnabled) : Boolean(reminders[activity.id]),
        subscribedToCreator: Boolean(activity.subscribedToCreator),
        taskCompleted: taskStatus === 'completed',
        taskActionText,
        taskProofUploaded: Boolean(taskProgress.proofSubmitted),
        taskProofNote: taskProgress.proofNote || '',
        ...checkInViewState(activity, joined)
      });
      this.syncCheckInTimer();
      if (activity.promotion?.hideShareButton && wx.hideShareMenu) wx.hideShareMenu();
      request(`/api/activities/${activity.id}/view`, {
        method: 'POST',
        data: { viewerKey: viewerKey() }
      }).catch(() => {});
      saveRecentActivity(activity);
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },
  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/index/index' });
  },
  loginWithWechat() {
    if (!wx.login) {
      return Promise.reject(new Error('当前环境不支持微信登录'));
    }
    return new Promise((resolve, reject) => {
      wx.login({
        success: async res => {
          try {
            if (!res.code) throw new Error('未获取到登录凭证');
            const login = await request('/api/auth/wechat-login', {
              method: 'POST',
              data: { code: res.code }
            });
            if (login.sessionId) wx.setStorageSync('lotteryToken', login.sessionId);
            saveProfile(login.profile);
            resolve(login.profile);
          } catch (error) {
            reject(error);
          }
        },
        fail: error => reject(new Error(error.errMsg || '登录失败'))
      });
    });
  },
  async ensureUserSession() {
    const profile = currentProfile();
    if (profile?.nickname) return profile;
    wx.showLoading({ title: '登录中' });
    try {
      const user = await this.loginWithWechat();
      wx.hideLoading();
      return user;
    } catch (error) {
      wx.hideLoading();
      throw error;
    }
  },
  async joinActivity() {
    try {
      const user = await this.ensureUserSession();
      if (!user?.nickname) throw new Error('请先完成微信登录');
      let location = null;
      if (this.data.activity?.conditions?.region) {
        wx.showLoading({ title: '校验位置' });
        try {
          location = await this.getCurrentLocation();
        } finally {
          wx.hideLoading();
        }
      }
      const surveyQuestions = this.data.activity?.conditions?.surveyQuestions || [];
      const surveyAnswers = surveyQuestions.map(question => ({
        questionId: question.id,
        value: String(this.data.surveyAnswers[question.id] || '').trim()
      }));
      const missingQuestion = surveyQuestions.find((question, index) => question.required && !surveyAnswers[index].value);
      if (missingQuestion) throw new Error(`请填写：${missingQuestion.title}`);
      let groupProof = '';
      if (this.data.activity?.conditions?.groupOnly) {
        if (this.data.activity.conditions.groupType !== 'wecom') {
          wx.showLoading({ title: '校验微信群' });
          try {
            groupProof = await requestWechatGroupProof();
          } finally {
            wx.hideLoading();
          }
        }
      }
      const result = await request(`/api/activities/${this.data.activity.id}/join`, {
        method: 'POST',
        data: {
          groupProof,
          location,
          surveyAnswers,
          answerText: this.data.answerText,
          voteAnswer: this.data.voteAnswer
        }
      });
      await this.loadActivity();
      if (result.pending) {
        wx.showModal({
          title: '申请已提交',
          content: '管理员审核通过后才会进入抽奖名单，可在当前页面查看审核状态。',
          showCancel: false,
          confirmText: '知道了'
        });
        return;
      }
      if (this.data.activity?.drawMode === 'instant') {
        const winners = Array.isArray(result.winners) ? result.winners : [];
        const remaining = Math.max(0, Number(result.attemptsRemaining || 0));
        wx.showModal({
          title: winners.length ? '恭喜中奖' : '本次未中奖',
          content: winners.length
            ? `恭喜获得${winners.map(item => item.prizeName).join('、')}，中奖记录可在“我的”查看。`
            : (remaining > 0 ? `本次未中奖，还可抽 ${remaining} 次。` : '本次未中奖，参与次数已用完。'),
          showCancel: false,
          confirmText: '知道了'
        });
        return;
      }
      const isRedPacketActivity = (this.data.activity?.prizes || []).some(item => item.type === '红包');
      const resultPrompt = await new Promise(resolve => {
        wx.showModal({
          title: '参与成功',
          content: isRedPacketActivity
            ? '已加入抽奖名单。可开启开奖结果和红包到账微信通知。'
            : '已加入抽奖名单。可开启开奖结果微信通知。',
          showCancel: true,
          cancelText: '暂不开启',
          confirmText: '开启通知',
          success: resolve,
          fail: () => resolve({ confirm: false })
        });
      });
      if (resultPrompt.confirm) {
        const types = isRedPacketActivity ? ['draw_result', 'cash'] : ['draw_result'];
        const subscription = await requestConfiguredLotterySubscriptions(types);
        if (subscription.accepted) {
          await Promise.all(subscription.acceptedTypes.map(type => request('/api/me/subscriptions', {
            method: 'POST',
            data: { activityId: this.data.activity.id, type }
          })));
          wx.showToast({ title: '微信通知已开启', icon: 'success' });
        } else {
          const message = subscriptionMessage(subscription, '开奖结果仍可在“我的”查看。');
          wx.showModal({ title: message.title, content: message.content, showCancel: false, confirmText: '知道了' });
        }
      }
    } catch (error) {
      if (/群|企业微信|公众号|位置|区域|问卷|关注|审核|任务|答|投票|中奖记录/.test(error.message || '')) {
        wx.showModal({
          title: '参与条件未满足',
          content: error.message || '请从活动指定微信群重新打开小程序。',
          showCancel: false,
          confirmText: '知道了'
        });
        return;
      }
      wx.showToast({ title: error.message, icon: 'none' });
    }
  },
  async getCurrentLocation() {
    if (!wx.getLocation) return Promise.reject(new Error('当前环境不支持位置校验'));
    await requirePrivacyAuthorization();
    return new Promise((resolve, reject) => {
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: true,
        success: result => resolve({ latitude: result.latitude, longitude: result.longitude }),
        fail: error => reject(new Error(/auth|deny/i.test(error.errMsg || '')
          ? '请授权获取当前位置后再参与'
          : (error.errMsg || '当前位置获取失败')))
      });
    });
  },
  onSurveyAnswerInput(event) {
    const questionId = event.currentTarget.dataset.question;
    this.setData({ [`surveyAnswers.${questionId}`]: event.detail.value });
  },
  onEligibilityInput(event) {
    const field = event.currentTarget.dataset.field;
    this.setData({ [field]: event.detail.value });
  },
  async chooseTaskProof() {
    const taskStatus = this.data.activity?.taskProgress?.status || 'not_started';
    if (!['started', 'rejected'].includes(taskStatus)) return;
    try {
      await this.ensureUserSession();
      await requirePrivacyAuthorization();
      const selected = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          sizeType: ['compressed'],
          success: resolve,
          fail: error => {
            if (/cancel/i.test(error.errMsg || '')) return resolve({ tempFiles: [] });
            reject(new Error(error.errMsg || '凭证图片选择失败'));
          }
        });
      });
      const file = selected.tempFiles?.[0];
      if (!file) return;
      if (Number(file.size || 0) > 5 * 1024 * 1024) throw new Error('凭证图片不能超过 5MB');
      wx.showLoading({ title: '上传凭证' });
      const uploaded = await uploadFile(`/api/activities/${this.activityId}/task/proof`, file.tempFilePath, {
        name: 'file',
        formData: { proofNote: this.data.taskProofNote }
      });
      this.setData({
        taskProofUploaded: Boolean(uploaded.proofSubmitted)
      });
      wx.showToast({ title: '凭证已上传', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '凭证上传失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
  async toggleTaskCompleted() {
    if (this.data.taskCompleted) return;
    try {
      await this.ensureUserSession();
      const progress = this.data.activity?.taskProgress || { status: 'not_started' };
      if (progress.status === 'pending') return;
      if (progress.status === 'not_started') {
        const result = await request(`/api/activities/${this.activityId}/task/start`, { method: 'POST' });
        this.setData({
          'activity.taskProgress': result,
          taskActionText: this.data.activity?.conditions?.taskProofRequired ? '提交完成凭证' : '确认任务完成'
        });
        const seconds = Math.max(1, Math.ceil((Date.parse(result.readyAt || '') - Date.now()) / 1000));
        wx.showModal({
          title: '任务已开始',
          content: `请按活动要求完成任务，至少体验 ${seconds} 秒后返回本页确认。`,
          showCancel: false,
          confirmText: '知道了'
        });
        return;
      }
      if (this.data.activity?.conditions?.taskProofRequired && !this.data.taskProofUploaded) {
        throw new Error('请先上传任务完成凭证');
      }
      const result = await request(`/api/activities/${this.activityId}/task/complete`, {
        method: 'POST',
        data: {}
      });
      const isCompleted = result.status === 'completed';
      this.setData({
        'activity.taskProgress': result,
        taskCompleted: isCompleted,
        taskActionText: isCompleted ? '任务已审核通过' : '凭证审核中'
      });
      wx.showModal({
        title: isCompleted ? '任务已完成' : '凭证已提交',
        content: isCompleted ? '任务已满足参与条件。' : '运营审核通过后，才可以加入抽奖池。',
        showCancel: false,
        confirmText: '知道了'
      });
    } catch (error) {
      wx.showToast({ title: error.message || '任务确认失败', icon: 'none' });
    }
  },
  async handleCheckInTask() {
    const activity = this.data.activity;
    if (!activity?.conditions?.checkIn || !this.data.joined || this.data.checkInActionDisabled) return;
    try {
      await this.ensureUserSession();
      const progress = activity.checkInProgress || { status: 'not_started' };
      if (progress.status === 'started' && Date.parse(progress.readyAt || '') > Date.now()) {
        this.setData(checkInViewState(activity, true));
        return;
      }
      wx.showLoading({ title: progress.status === 'started' ? '完成打卡中' : '开始打卡中' });
      const result = await request(`/api/activities/${this.activityId}/check-in/${progress.status === 'started' ? 'complete' : 'start'}`, {
        method: 'POST'
      });
      wx.hideLoading();
      await this.loadActivity();
      if (result.status === 'completed') {
        wx.showModal({
          title: '打卡完成',
          content: `已获得 ${result.bonusWeight} 倍抽奖权重，开奖结果将按当前权重参与计算。`,
          showCancel: false,
          confirmText: '知道了'
        });
        return;
      }
      const seconds = Math.max(1, Math.ceil((Date.parse(result.readyAt || '') - Date.now()) / 1000));
      wx.showModal({
        title: '打卡已开始',
        content: `服务器已开始计时，请在 ${seconds} 秒后返回完成打卡并领取权重奖励。`,
        showCancel: false,
        confirmText: '知道了'
      });
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: error.message || '打卡操作失败', icon: 'none' });
    }
  },
  selectVote(event) {
    this.setData({ voteAnswer: event.currentTarget.dataset.option });
  },
  async submitComment() {
    const content = String(this.data.commentText || '').trim();
    if (!content) {
      wx.showToast({ title: '请输入留言内容', icon: 'none' });
      return;
    }
    try {
      await this.ensureUserSession();
      await request(`/api/activities/${this.activityId}/comments`, { method: 'POST', data: { content } });
      this.setData({ commentText: '' });
      await this.loadActivity();
      wx.showToast({ title: '留言成功', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '留言失败', icon: 'none' });
    }
  },
  async subscribeCreator() {
    try {
      await this.ensureUserSession();
      const result = await request(`/api/activities/${this.activityId}/creator-subscription`, {
        method: 'POST',
        data: { subscribed: !this.data.subscribedToCreator }
      });
      this.setData({ subscribedToCreator: result.subscribed });
      wx.showToast({ title: result.subscribed ? '关注成功' : '已取消关注', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: error.message || '订阅操作失败', icon: 'none' });
    }
  },
  async assistFriend() {
    if (!this.data.activity || !this.data.assistTargetId || this.data.assisted) return;
    try {
      await this.ensureUserSession();
      const result = await request(`/api/activities/${this.data.activity.id}/assist`, {
        method: 'POST',
        data: { targetParticipantId: this.data.assistTargetId }
      });
      this.setData({ assisted: true });
      wx.showModal({
        title: result.assisted ? '助力成功' : '已经助力过了',
        content: `好友当前已获得 ${result.effectiveAssistCount} 次有效助力，抽奖权重为 ${result.drawWeight}。`,
        showCancel: false,
        confirmText: '知道了'
      });
    } catch (error) {
      wx.showToast({ title: error.message || '助力失败', icon: 'none' });
    }
  },
  async remind() {
    if (!this.data.activity) return;
    if (this.data.reminded) {
      wx.showModal({
        title: '微信提醒已开启',
        content: `${this.data.drawTime}开奖，已开启微信服务通知提醒。`,
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    try {
      await this.ensureUserSession();
    } catch (error) {
      wx.showToast({ title: error.message || '登录失败', icon: 'none' });
      return;
    }
    const subscribeResult = await requestConfiguredLotterySubscription('draw_reminder');
    if (subscribeResult.accepted) {
      try {
        await request('/api/me/subscriptions', {
          method: 'POST',
          data: { activityId: this.data.activity.id, type: 'draw_reminder' }
        });
      } catch (error) {
        wx.showToast({ title: error.message || '提醒保存失败', icon: 'none' });
        return;
      }
    }
    if (!subscribeResult.accepted) {
      const message = subscriptionMessage(
        subscribeResult,
        `${this.data.drawTime}开奖，开奖状态可在“我的”查看。`
      );
      wx.showModal({
        title: message.title,
        content: message.content,
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    const reminders = readStorageObject(ACTIVITY_REMINDER_STORAGE_KEY);
    const id = this.data.activity.id;
    reminders[id] = {
      id,
      title: this.data.activity.title,
      drawTime: this.data.drawTime,
      createdAt: new Date().toISOString(),
      subscribeStatus: subscribeResult.status,
      nativeSubscribed: subscribeResult.accepted
    };
    writeStorageObject(ACTIVITY_REMINDER_STORAGE_KEY, reminders);
    this.setData({ reminded: true });
    if (wx.vibrateShort) {
      wx.vibrateShort({ type: 'light' });
    }
    const message = subscriptionMessage(
      subscribeResult,
      `${this.data.drawTime}开奖，开奖状态可在“我的”查看。`
    );
    wx.showModal({
      title: message.title,
      content: message.content,
      showCancel: false,
      confirmText: '知道了'
    });
  }
});
