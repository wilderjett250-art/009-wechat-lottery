const { request } = require('./request');

function readGroupEnterInfo() {
  if (typeof wx.getGroupEnterInfo !== 'function') {
    return Promise.reject(new Error('当前微信版本不支持群身份校验，请升级微信后重试'));
  }
  return new Promise((resolve, reject) => {
    wx.getGroupEnterInfo({
      success(result) {
        if (!result?.encryptedData || !result?.iv) {
          reject(new Error('请从目标微信群的聊天卡片重新打开小程序'));
          return;
        }
        resolve(result);
      },
      fail() {
        reject(new Error('请从目标微信群的聊天卡片重新打开小程序'));
      }
    });
  });
}

function loginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        if (!result?.code) {
          reject(new Error('未获取到微信群校验凭证'));
          return;
        }
        resolve(result.code);
      },
      fail(error) {
        reject(new Error(error?.errMsg || '微信群校验登录失败'));
      }
    });
  });
}

async function requestWechatGroupProof() {
  const code = await loginCode();
  const groupInfo = await readGroupEnterInfo();
  const result = await request('/api/wechat/group-proof', {
    method: 'POST',
    data: {
      code,
      encryptedData: groupInfo.encryptedData,
      iv: groupInfo.iv
    }
  });
  if (!result?.groupProof) throw new Error('微信群身份校验未返回有效结果');
  return result.groupProof;
}

module.exports = { requestWechatGroupProof };
