const subscribeConfig = require('../config/subscribe');
const { request } = require('./request');

function getTemplateId(type) {
  let stored = {};
  try {
    stored = wx.getStorageSync('lotterySubscribeTemplateIds') || {};
  } catch (error) {
    stored = {};
  }
  const capabilityKeyByType = {
    cash: 'cash',
    draw_result: 'drawResult',
    draw: 'drawReminder',
    draw_reminder: 'drawReminder',
    comment: 'comment'
  };
  const legacyKeyByType = {
    cash: 'cashReminderTemplateId',
    draw_result: 'drawResultTemplateId',
    draw: 'drawReminderTemplateId',
    draw_reminder: 'drawReminderTemplateId',
    comment: 'commentReplyTemplateId'
  };
  const capability = stored[capabilityKeyByType[type]];
  if (capability && typeof capability === 'object') return capability.templateId || '';
  const legacyKey = legacyKeyByType[type] || 'drawReminderTemplateId';
  if (stored[legacyKey]) return stored[legacyKey];
  if (type === 'cash') return subscribeConfig.cashReminderTemplateId || '';
  if (type === 'draw_result') return subscribeConfig.drawResultTemplateId || '';
  if (type === 'comment') return subscribeConfig.commentReplyTemplateId || '';
  return subscribeConfig.drawReminderTemplateId || '';
}

function canRequestSubscribeMessage(templateId) {
  return Boolean(templateId && wx.requestSubscribeMessage);
}

function requestLotterySubscriptions(types) {
  const requestedTypes = [...new Set((Array.isArray(types) ? types : [types]).filter(Boolean))];
  const typeByTemplateId = Object.fromEntries(requestedTypes.map(type => [getTemplateId(type), type]).filter(([templateId]) => templateId));
  const templateIds = Object.keys(typeByTemplateId);
  if (!templateIds.length || !wx.requestSubscribeMessage) {
    return Promise.resolve({
      nativePrompt: false,
      accepted: false,
      acceptedTypes: [],
      templateId: templateIds[0] || '',
      status: 'not_configured'
    });
  }

  return new Promise(resolve => {
    wx.requestSubscribeMessage({
      tmplIds: templateIds,
      success(res) {
        const acceptedTypes = templateIds
          .filter(templateId => res[templateId] === 'accept')
          .map(templateId => typeByTemplateId[templateId]);
        const status = acceptedTypes.length ? 'accept' : (res[templateIds[0]] || 'unknown');
        resolve({
          nativePrompt: true,
          accepted: acceptedTypes.length > 0,
          acceptedTypes,
          templateId: templateIds[0],
          status,
          statuses: Object.fromEntries(templateIds.map(templateId => [typeByTemplateId[templateId], res[templateId] || 'unknown']))
        });
      },
      fail(error) {
        resolve({
          nativePrompt: false,
          accepted: false,
          acceptedTypes: [],
          templateId: templateIds[0],
          status: 'fail',
          errMsg: error.errMsg || ''
        });
      }
    });
  });
}

function requestLotterySubscription(type) {
  return requestLotterySubscriptions([type]);
}

function capabilityKey(type) {
  if (type === 'draw' || type === 'draw_reminder') return 'drawReminder';
  if (type === 'draw_result') return 'drawResult';
  if (type === 'cash') return 'cash';
  if (type === 'comment') return 'comment';
  return '';
}

async function requestConfiguredLotterySubscriptions(types) {
  const requestedTypes = [...new Set((Array.isArray(types) ? types : [types]).filter(Boolean))];
  const capabilities = await request('/api/integrations/capabilities', { autoRelogin: false });
  const templates = capabilities?.subscriptionTemplates || {};
  const configuredTypes = requestedTypes.filter(type => templates[capabilityKey(type)]?.configured === true);
  const unavailableTypes = requestedTypes.filter(type => !configuredTypes.includes(type));
  if (!configuredTypes.length) {
    return {
      nativePrompt: false,
      accepted: false,
      acceptedTypes: [],
      templateId: '',
      status: 'not_configured',
      unavailableTypes
    };
  }
  const result = await requestLotterySubscriptions(configuredTypes);
  return { ...result, unavailableTypes };
}

function requestConfiguredLotterySubscription(type) {
  return requestConfiguredLotterySubscriptions([type]);
}

function subscriptionMessage(result, fallbackContent) {
  if (!result.nativePrompt) {
    return {
      title: '提醒未开启',
      content: `${fallbackContent}\n\n当前微信订阅消息尚未配置，请稍后再试。`
    };
  }
  if (result.accepted) {
    return {
      title: '微信提醒已开启',
        content: `${fallbackContent}\n\n微信将在活动开奖前通过服务通知提醒你。`
    };
  }
  return {
    title: '提醒未开启',
    content: `${fallbackContent}\n\n你这次没有允许微信服务通知，可再次点击按钮重新授权。`
  };
}

module.exports = {
  requestLotterySubscription,
  requestLotterySubscriptions,
  requestConfiguredLotterySubscription,
  requestConfiguredLotterySubscriptions,
  subscriptionMessage
};
