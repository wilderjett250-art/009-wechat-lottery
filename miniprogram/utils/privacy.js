const DEFAULT_CONTRACT_NAME = '《小程序用户隐私保护指引》';

let initialized = false;
let privacyState = {
  visible: false,
  contractName: DEFAULT_CONTRACT_NAME,
  referrer: ''
};
let pendingAuthorizations = [];
const subscribers = new Set();

function notifySubscribers() {
  const snapshot = { ...privacyState };
  subscribers.forEach(listener => listener(snapshot));
}

function updatePrivacyState(nextState) {
  privacyState = { ...privacyState, ...nextState };
  notifySubscribers();
}

function initializePrivacyAuthorization() {
  if (initialized || typeof wx === 'undefined') return;
  initialized = true;

  if (typeof wx.getPrivacySetting === 'function') {
    wx.getPrivacySetting({
      success: result => {
        if (result.privacyContractName) {
          updatePrivacyState({ contractName: result.privacyContractName });
        }
      }
    });
  }

  if (typeof wx.onNeedPrivacyAuthorization !== 'function') return;
  wx.onNeedPrivacyAuthorization((resolve, eventInfo = {}) => {
    pendingAuthorizations.push({ resolve, eventInfo });
    updatePrivacyState({
      visible: true,
      referrer: String(eventInfo.referrer || '')
    });
    try {
      resolve({ event: 'exposureAuthorization' });
    } catch (error) {
      // Older base libraries can ignore exposure reporting.
    }
  });
}

function subscribePrivacyState(listener) {
  subscribers.add(listener);
  listener({ ...privacyState });
  return () => subscribers.delete(listener);
}

function settlePrivacyAuthorization(event, buttonId = '') {
  const authorizations = pendingAuthorizations;
  pendingAuthorizations = [];
  updatePrivacyState({ visible: false, referrer: '' });
  authorizations.forEach(item => {
    try {
      item.resolve(event === 'agree'
        ? { event: 'agree', buttonId }
        : { event: 'disagree' });
    } catch (error) {
      // A completed privacy request no longer needs resolving.
    }
  });
}

function privacyError(error) {
  const message = String(error?.errMsg || error?.message || '');
  if (/privacy|disagree|deny|cancel/i.test(message)) {
    return new Error('请先同意隐私保护指引后再使用此功能');
  }
  return new Error(message || '隐私授权未完成');
}

function requirePrivacyAuthorization() {
  initializePrivacyAuthorization();
  if (typeof wx === 'undefined' || typeof wx.requirePrivacyAuthorize !== 'function') {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    wx.requirePrivacyAuthorize({
      success: resolve,
      fail: error => reject(privacyError(error))
    });
  });
}

module.exports = {
  initializePrivacyAuthorization,
  subscribePrivacyState,
  settlePrivacyAuthorization,
  requirePrivacyAuthorization
};
