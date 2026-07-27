const PROD_BASE_URL = 'https://lottery.example.com';
const LOCAL_BASE_URL = 'http://127.0.0.1:5177';

function getEnvVersion() {
  try {
    const accountInfo = wx.getAccountInfoSync();
    return accountInfo?.miniProgram?.envVersion || 'release';
  } catch (error) {
    return 'release';
  }
}

function isDevTools() {
  try {
    if (typeof wx.getDeviceInfo === 'function') {
      return wx.getDeviceInfo().platform === 'devtools';
    }
    return wx.getSystemInfoSync().platform === 'devtools';
  } catch (error) {
    return false;
  }
}

function shouldUseLocalBackend() {
  if (!isDevTools()) return false;
  try {
    return wx.getStorageSync('lotteryUseLocalBackend') === true;
  } catch (error) {
    return false;
  }
}

const ENV_VERSION = getEnvVersion();
const USE_LOCAL_BACKEND = ENV_VERSION === 'develop' && shouldUseLocalBackend();
const BASE_URL = USE_LOCAL_BACKEND ? LOCAL_BASE_URL : PROD_BASE_URL;

function assetUrl(value) {
  if (!value) return '';
  if (value.startsWith('data:')) return value;
  if (value.startsWith('/assets/')) return value;
  if (/^https?:\/\//.test(value)) return value;
  return `${BASE_URL}${value}`;
}

let reloginPromise = null;

function storedToken() {
  try {
    return wx.getStorageSync('lotteryToken') || '';
  } catch (error) {
    return '';
  }
}

function updateAppUser(profile) {
  try {
    const app = getApp();
    if (app?.globalData) app.globalData.user = profile || null;
  } catch (error) {
    // The request helper is also loaded before App initialization in some test paths.
  }
}

function clearStoredSession() {
  try {
    wx.removeStorageSync('lotteryToken');
    wx.removeStorageSync('lotteryProfile');
  } catch (error) {
    // Storage cleanup is best-effort; the server remains authoritative.
  }
  updateAppUser(null);
}

function requestError(payload, fallbackMessage, statusCode) {
  const error = new Error(payload?.msg || fallbackMessage);
  error.statusCode = statusCode;
  error.code = payload?.code;
  return error;
}

function loginWithWechat() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(loginResult) {
        if (!loginResult.code) {
          reject(new Error('未获取到微信登录凭证'));
          return;
        }
        wx.request({
          url: `${BASE_URL}/api/auth/wechat-login`,
          method: 'POST',
          data: { code: loginResult.code },
          header: { 'Content-Type': 'application/json' },
          success(res) {
            const payload = res.data || {};
            if (res.statusCode >= 200 && res.statusCode < 300 && payload.code === 0) {
              const login = payload.data || {};
              wx.setStorageSync('lotteryToken', login.sessionId || '');
              wx.setStorageSync('lotteryProfile', login.profile || null);
              updateAppUser(login.profile || null);
              resolve(login);
              return;
            }
            reject(requestError(payload, '微信登录失败', res.statusCode));
          },
          fail(err) {
            reject(new Error(err.errMsg || '微信登录失败'));
          }
        });
      },
      fail(err) {
        reject(new Error(err.errMsg || '微信登录失败'));
      }
    });
  });
}

function refreshWechatSession() {
  if (!reloginPromise) {
    reloginPromise = loginWithWechat().then(
      result => {
        reloginPromise = null;
        return result;
      },
      error => {
        reloginPromise = null;
        throw error;
      }
    );
  }
  return reloginPromise;
}

function performRequest(path, options, retried) {
  const token = storedToken();
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${path}`,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        Authorization: token ? `Bearer ${token}` : ''
      },
      success(res) {
        const payload = res.data || {};
        if (res.statusCode >= 200 && res.statusCode < 300 && payload.code === 0) {
          resolve(payload.data);
          return;
        }
        const canRelogin = res.statusCode === 401 &&
          !retried &&
          options.autoRelogin !== false &&
          path !== '/api/auth/wechat-login';
        if (canRelogin) {
          clearStoredSession();
          refreshWechatSession()
            .then(() => performRequest(path, options, true))
            .then(resolve, reject);
          return;
        }
        reject(requestError(payload, '请求失败', res.statusCode));
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络异常'));
      }
    });
  });
}

function request(path, options = {}) {
  return performRequest(path, options, false);
}

function performUpload(path, filePath, options, retried) {
  const token = storedToken();
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${BASE_URL}${path}`,
      filePath,
      name: options.name || 'file',
      formData: options.formData || {},
      header: {
        Authorization: token ? `Bearer ${token}` : ''
      },
      success(res) {
        let payload;
        try {
          payload = typeof res.data === 'string' ? JSON.parse(res.data) : (res.data || {});
        } catch (error) {
          reject(new Error('服务器返回格式异常'));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300 && payload.code === 0) {
          resolve(payload.data);
          return;
        }
        const canRelogin = res.statusCode === 401 && !retried && options.autoRelogin !== false;
        if (canRelogin) {
          clearStoredSession();
          refreshWechatSession()
            .then(() => performUpload(path, filePath, options, true))
            .then(resolve, reject);
          return;
        }
        reject(requestError(payload, '上传失败', res.statusCode));
      },
      fail(err) {
        reject(new Error(err.errMsg || '上传失败'));
      }
    });
  });
}

function uploadFile(path, filePath, options = {}) {
  return performUpload(path, filePath, options, false);
}

module.exports = { request, assetUrl, uploadFile };
