import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, '..');

async function readSource(relativePath) {
  return readFile(path.join(projectRoot, relativePath), 'utf8');
}

test('tab bar uses the three requested sections', async () => {
  const appJson = JSON.parse(await readSource('miniprogram/app.json'));
  assert.deepEqual(appJson.tabBar.list.map(item => item.text), [
    '首页',
    '发起抽奖',
    '我的'
  ]);
  assert.equal(appJson.tabBar.list.length, 3);
  assert.equal(appJson.window.navigationBarBackgroundColor, '#FFFFFF');
  assert.equal(appJson.window.navigationBarTextStyle, 'black');
});

test('home page uses real swipeable official, cash and daily activity data without ads', async () => {
  const indexWxml = await readSource('miniprogram/pages/index/index.wxml');
  const indexJs = await readSource('miniprogram/pages/index/index.js');
  const indexWxss = await readSource('miniprogram/pages/index/index.wxss');
  assert.match(indexWxml, /official-swiper/);
  assert.match(indexWxml, /previous-margin="136rpx" next-margin="136rpx"/);
  assert.match(indexWxml, /padding-top: calc\(\{\{navMetrics\.navHeight\}\}px \+ 54rpx\)/);
  assert.match(indexWxml, /home-navbar/);
  assert.match(indexJs, /onPageScroll/);
  assert.match(indexWxml, /<swiper-item/);
  assert.match(indexWxml, /cash-section/);
  assert.match(indexWxml, /cash-scroll/);
  assert.match(indexWxml, /cash-card/);
  assert.match(indexWxml, /cash-draw-circle/);
  assert.doesNotMatch(indexWxml, /cash-ticket-image|index === 0 \? 'first'/);
  assert.match(indexWxml, /today-section/);
  assert.match(indexWxml, /today-list/);
  assert.match(indexJs, /request\('\/api\/home'\)/);
  assert.match(indexJs, /requestConfiguredLotterySubscription/);
  assert.match(indexJs, /hasSession \? Boolean\(item\.reminderEnabled\)/);
  assert.doesNotMatch(indexWxml, /home-tools|bindtap="checkIn"|bindtap="openPasscode"/);
  assert.doesNotMatch(indexJs, /loadCheckIn|async checkIn\(|openPasscode\(/);
  assert.doesNotMatch(indexWxss, /\.home-tools|\.home-tool|\.tool-heart|\.tool-key/);
  assert.match(indexWxss, /\.cash-section \.cash-card \.cash-remind-button\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?bottom:\s*26rpx;/);
  assert.match(indexWxss, /\.cash-section \.cash-card \.cash-date\s*\{[\s\S]*?white-space:\s*nowrap;/);
  assert.match(indexWxss, /\.cash-section \.cash-card\s*\{[^}]*flex:\s*0 0 204rpx;/);
  assert.match(indexWxss, /\.cash-draw-circle\s*\{[^}]*position:\s*absolute;[^}]*bottom:\s*18rpx;/s);
  assert.doesNotMatch(indexWxml, /广告|record-ad-card|create-ad-card|立即试玩|寻道大千/);
});

test('create tab directly exposes the requested full lottery form and template strip', async () => {
  const createWxml = await readSource('miniprogram/pages/create/create.wxml');
  const createJs = await readSource('miniprogram/pages/create/create.js');
  const createWxss = await readSource('miniprogram/pages/create/create.wxss');
  for (const title of [
    '新样式',
    '微信群抽奖',
    '年会抽奖',
    '公众号抽奖',
    '小红书抽奖',
    '按人数解锁奖品',
    '趣味抽奖',
    '首页推广抽奖'
  ]) {
    assert.match(createJs, new RegExp(title));
  }
  assert.match(createWxml, /template-strip/);
  assert.match(createWxml, /advanced-benefit-row/);
  assert.match(createWxml, /bindchange="toggleAdvancedOption"/);
  assert.doesNotMatch(createWxml, /\u70b9\u51fb\u5f00\u542f/u);
  assert.match(createJs, /requestConfiguredLotterySubscription\('comment'\)/);
  assert.match(createJs, /pages\/recent-winner-range\/recent-winner-range/);
  assert.match(createJs, /recentWinnerActivityIds/);
  assert.match(createJs, /type:\s*'comment'/);
  assert.match(createWxml, /更换图片/);
  assert.match(createWxml, /展开更多功能/);
  assert.match(createWxml, /收起更多功能/);
  assert.match(createWxml, /高级功能/);
  assert.match(createWxss, /\.reference-launch \.create-preview\s*\{[^}]*height:\s*calc\(100vw - 80rpx\);[^}]*max-height:\s*680rpx;/s);
  assert.doesNotMatch(createWxml, /支付|¥/);
  assert.doesNotMatch(createJs, /wx\.requestPayment|advancedPaymentOrderId/);
  assert.doesNotMatch(`${createWxml}\n${createJs}`, /广告|create-ad-card|ad-ribbon|ad-map/);
});

test('official-account condition opens a real authorization selection page', async () => {
  const appJson = JSON.parse(await readSource('miniprogram/app.json'));
  const createJs = await readSource('miniprogram/pages/create/create.js');
  const authorizationJs = await readSource('miniprogram/pages/official-account/official-account.js');
  const authorizationWxml = await readSource('miniprogram/pages/official-account/official-account.wxml');
  const authorizationWxss = await readSource('miniprogram/pages/official-account/official-account.wxss');
  const authorizationWebView = await readSource('miniprogram/pages/official-account-auth/official-account-auth.wxml');
  assert.ok(appJson.pages.includes('pages/official-account/official-account'));
  assert.ok(appJson.pages.includes('pages/official-account-auth/official-account-auth'));
  assert.match(createJs, /pages\/official-account\/official-account/);
  assert.match(createJs, /officialAccountSelected/);
  assert.match(createJs, /officialAccountUnset/);
  assert.match(createJs, /authorizationEnabled: Boolean\(this\.data\.capabilities\.officialAccount\?\.authorizationEnabled\)/);
  assert.match(authorizationJs, /request\('\/api\/integrations\/official-accounts'\)/);
  assert.match(authorizationJs, /request\('\/api\/integrations\/official-accounts\/authorization'/);
  assert.match(authorizationJs, /pages\/official-account-auth\/official-account-auth/);
  assert.match(authorizationJs, /ensureUserSession/);
  assert.match(authorizationJs, /lotteryOfficialAccountSelection/);
  assert.match(authorizationWxml, /授权申请/);
  assert.match(authorizationWxml, /选择已授权的公众号/);
  assert.match(authorizationWxml, /添加新授权/);
  assert.match(authorizationWxml, /不设置/);
  assert.match(authorizationWxss, /\.none-option\.selected/);
  assert.match(authorizationWebView, /<web-view/);
});

test('launch form supports required prize and draw modes', async () => {
  const createJs = await readSource('miniprogram/pages/create/create.js');
  const launchWxml = await readSource('miniprogram/pages/launch/launch.wxml');
  const launchJs = await readSource('miniprogram/pages/launch/launch.js');
  const detailJs = await readSource('miniprogram/pages/detail/detail.js');
  const detailWxml = await readSource('miniprogram/pages/detail/detail.wxml');
  assert.match(createJs, /selectTemplate/);
  assert.match(createJs, /applyTemplatePreset/);
  assert.match(launchWxml, /templateOptions/);
  assert.match(launchWxml, /{{creatorName}}/);
  assert.doesNotMatch(launchWxml, /小生我怕怕/);
  assert.match(launchJs, /templateType/);
  assert.match(launchJs, /lotteryProfile/);
  assert.match(launchJs, /decodeURIComponent\(options\.type\)/);
  for (const title of ['奖品', '优惠券', '红包', '商城奖品']) {
    assert.match(launchJs, new RegExp(title));
  }
  for (const title of ['按时间开奖', '按人数开奖', '即抽即中']) {
    assert.match(launchJs, new RegExp(title));
  }
  assert.match(launchWxml, /微信群类型/);
  assert.match(launchJs, /普通微信群/);
  assert.match(launchWxml, /选择客户群/);
  assert.match(launchWxml, /选择所在的企业/);
  assert.match(launchJs, /\/api\/integrations\/wecom\/groups/);
  assert.match(launchJs, /wx\.showActionSheet/);
  assert.match(launchJs, /requestWechatGroupProof/);
  assert.match(launchJs, /\/api\/integrations\/capabilities/);
  assert.match(launchJs, /wx\.chooseLocation/);
  assert.match(launchWxml, /中心位置/);
  assert.match(launchWxml, /必答问题/);
  assert.match(launchWxml, /添加奖项/);
  assert.match(launchWxml, /发放方式/);
  assert.match(launchWxml, /面额/);
  assert.match(launchWxml, /展开更多功能/);
  assert.match(launchWxml, /高级功能/);
  assert.match(launchWxml, /近期抽奖范围/);
  assert.match(launchJs, /\/api\/me\/activities\/recent-ended|recent-winner-range/);
  assert.match(launchJs, /recentWinnerActivityIds/);
  assert.match(launchJs, /requestConfiguredLotterySubscription\('comment'\)/);
  assert.match(launchJs, /type:\s*'comment'/);
  assert.doesNotMatch(launchWxml, /支付|¥/);
  assert.doesNotMatch(launchJs, /wx\.requestPayment|advancedPaymentOrderId|\/api\/payments\/orders/);
  for (const title of ['填写问卷后参与', '答题后参与', '投票后参与']) {
    assert.match(launchJs, new RegExp(title));
  }
  for (const label of ['选择公众号', '设置审核内容', '指定区域范围', '设置问卷', '点击设置任务', '设置答题', '设置投票']) {
    assert.match(launchWxml, new RegExp(label));
  }
  assert.match(launchJs, /checkIn/);
  assert.match(launchJs, /设置打卡任务/);
  assert.match(launchWxml, /设置打卡内容/);
  assert.match(launchWxml, /打卡任务名称/);
  assert.doesNotMatch(`${createJs}\n${launchJs}\n${launchWxml}`, /输入口令后参与|passcode/);
  assert.match(launchWxml, /disabled="{{condition\.disabled}}"/);
  assert.match(launchWxml, /condition-editor-sheet/);
  assert.match(launchJs, /compatibleConditionPairs/);
  assert.match(launchJs, /conditionsCompatible/);
  assert.match(launchJs, /reviewPrompt/);
  assert.match(launchJs, /assistWeight/);
  assert.match(launchJs, /taskProofRequired/);
  assert.match(launchWxml, /每次助力增加权重/);
  assert.match(launchWxml, /上传截图凭证/);
  assert.match(detailWxml, /当前抽奖权重/);
  assert.match(detailWxml, /参与后打卡任务/);
  assert.match(detailWxml, /上传任务凭证/);
  assert.match(detailJs, /\/task\/proof/);
  assert.match(detailJs, /\/check-in\//);
  assert.match(detailJs, /proofSubmitted/);
  assert.doesNotMatch(launchJs, /玩游戏参与抽奖|key:\s*['"]game['"]/);
  assert.doesNotMatch(launchWxml, /condition\.key === ['"]game['"]|通关点击数/);
  assert.match(launchJs, /wx\.chooseMedia/);
  assert.match(launchJs, /\/api\/uploads\/image/);
  assert.match(launchJs, /prizes:\s*prizes\.map/);
  assert.match(launchJs, /faceValue/);
  assert.match(launchJs, /unlockParticipants/);
  assert.match(launchJs, /instantPerUserLimit/);
  assert.match(launchJs, /instantParticipantLimit/);
  for (const label of [
    '奖品解锁人数',
    '末等奖项不可设置',
    '达到指定人数自动开奖',
    '未达到人数自动开奖时间',
    '单人参与次数限制',
    '参与人数上限',
    '抽奖截止时间'
  ]) {
    assert.match(launchWxml, new RegExp(label));
  }
  const groupProofJs = await readSource('miniprogram/utils/group-proof.js');
  assert.match(groupProofJs, /wx\.getGroupEnterInfo/);
  assert.match(groupProofJs, /\/api\/wechat\/group-proof/);
});

test('launch action bar stays fixed while only the form content scrolls', async () => {
  for (const page of ['create', 'launch']) {
    const pageJson = JSON.parse(await readSource(`miniprogram/pages/${page}/${page}.json`));
    const wxml = await readSource(`miniprogram/pages/${page}/${page}.wxml`);
    const wxss = await readSource(`miniprogram/pages/${page}/${page}.wxss`);
    assert.equal(pageJson.disableScroll, true);
    assert.match(wxml, /<scroll-view class="launch-content"[\s\S]*?<\/scroll-view>\s*<view class="create-bottom-bar[^"]*">/);
    const barRule = wxss.match(/\.reference-launch \.create-bottom-bar\s*\{([\s\S]*?)\}/)?.[1] || '';
    assert.match(barRule, /position:\s*fixed;/);
    assert.match(barRule, /bottom:\s*0;/);
    assert.match(barRule, /z-index:\s*200;/);
    assert.match(wxss, /\.launch-safe-space\s*\{[\s\S]*?safe-area-inset-bottom/);
    assert.match(wxss, /\.reference-launch \.launch-button\s*\{[\s\S]*?background:\s*#ec443c;/);
  }
});

test('template entries open standalone creation flows with persisted type-specific settings', async () => {
  const appJson = JSON.parse(await readSource('miniprogram/app.json'));
  const createJs = await readSource('miniprogram/pages/create/create.js');
  const createWxml = await readSource('miniprogram/pages/create/create.wxml');
  const launchJs = await readSource('miniprogram/pages/launch/launch.js');
  const launchWxml = await readSource('miniprogram/pages/launch/launch.wxml');
  const annualIntroWxml = await readSource('miniprogram/pages/annual-intro/annual-intro.wxml');
  const serverJs = await readSource('server.js');

  assert.ok(appJson.pages.includes('pages/annual-intro/annual-intro'));
  assert.match(createJs, /pages\/annual-intro\/annual-intro/);
  assert.match(createJs, /pages\/launch\/launch\?preset=/);
  assert.match(createJs, /standalone=1/);
  assert.match(createWxml, /style-selector-sheet/);
  assert.match(annualIntroWxml, /立即发起/);

  for (const preset of ['wechat', 'official', 'unlock', 'fun', 'annual']) {
    assert.match(launchJs, new RegExp(`template\\.key === '${preset}'`));
  }
  assert.match(launchJs, /specialConfig/);
  assert.match(launchJs, /annualReverseDraw/);
  assert.match(launchJs, /chooseAnnualImage/);
  assert.match(launchWxml, /typeIntroText/);
  assert.match(launchWxml, /annualConfig\.companyName/);
  assert.match(launchWxml, /fun-create-preview/);
  assert.match(launchWxml, /single-action/);
  assert.match(serverJs, /normalizeSpecialConfig/);
  assert.match(serverJs, /publicSpecialConfig/);
});

test('instant draw hides staged prize unlocking while standalone sign-in and passcode flows stay unavailable', async () => {
  const appJson = JSON.parse(await readSource('miniprogram/app.json'));
  assert.ok(!appJson.pages.includes('pages/check-in-task/check-in-task'));
  assert.ok(!appJson.pages.includes('pages/check-in-task-view/check-in-task-view'));

  for (const page of ['create', 'launch']) {
    const js = await readSource(`miniprogram/pages/${page}/${page}.js`);
    const wxml = await readSource(`miniprogram/pages/${page}/${page}.wxml`);
    assert.match(wxml, /wx:if="\{\{activeDrawMode !== 'instant'\}\}" class="form-row form-row-switch"/);
    assert.match(js, /activeDrawMode === 'instant' \? false : Boolean\(this\.data\.form\.unlockByPeople\)/);
    assert.doesNotMatch(`${js}\n${wxml}`, /输入口令后参与|passcode/);
    assert.match(js, /capabilityAvailable/);
    assert.match(js, /item\.key !== 'official'/);
    assert.match(js, /capabilities\.wecom\?\.configured/);
  }

  const launchJs = await readSource('miniprogram/pages/launch/launch.js');
  const launchWxml = await readSource('miniprogram/pages/launch/launch.wxml');
  assert.match(`${launchJs}\n${launchWxml}`, /设置打卡任务/);
  assert.match(launchJs, /assist: false, checkIn: false/);

  const detailJs = await readSource('miniprogram/pages/detail/detail.js');
  const detailWxml = await readSource('miniprogram/pages/detail/detail.wxml');
  assert.match(`${detailJs}\n${detailWxml}`, /\/check-in\//);
  assert.match(detailJs, /handleCheckInTask/);
  assert.doesNotMatch(`${detailJs}\n${detailWxml}`, /参与口令|passcode/);
});

test('records page shows the reference empty state without ads', async () => {
  const recordsWxml = await readSource('miniprogram/pages/records/records.wxml');
  const recordsJs = await readSource('miniprogram/pages/records/records.js');
  assert.match(recordsWxml, /record-empty-card/);
  assert.match(recordsWxml, /empty-document/);
  assert.doesNotMatch(recordsWxml, /广告|record-ad-card|record-ad-image|立即试玩|寻道大千/);
  assert.doesNotMatch(recordsWxml, /template-banner/);
  assert.match(recordsJs, /lotteryRecentActivitiesV1/);
});

test('profile page exposes member center business entries', async () => {
  const profileWxml = await readSource('miniprogram/pages/profile/profile.wxml');
  const profileJs = await readSource('miniprogram/pages/profile/profile.js');
  const requestJs = await readSource('miniprogram/utils/request.js');
  assert.match(profileWxml, /profile-page/);
  assert.match(profileWxml, /mine-user-row/);
  assert.match(profileWxml, /mine-user-arrow/);
  assert.match(profileWxml, /红包余额/);
  assert.match(profileWxml, /优惠券/);
  assert.match(profileWxml, /订单/);
  assert.match(profileWxml, /商城/);
  assert.match(profileWxml, /全部抽奖/);
  assert.match(profileWxml, /发起抽奖/);
  assert.match(profileWxml, /中奖记录/);
  for (const entry of [
    '活动管理', '中奖核销', '团队管理', '草稿箱', '发起人信息', '授权管理',
    '黑名单管理', '资金管理', '抽奖主页', '成长中心', '智能推广', '专属顾问'
  ]) {
    assert.match(profileJs, new RegExp(entry));
  }
  for (const entry of ['消息', '推广合作', '设置', '常见问题']) {
    assert.match(profileJs, new RegExp(entry));
  }
  assert.match(profileJs, /wx\.login/);
  assert.doesNotMatch(profileJs, /wx\.getUserProfile/);
  assert.match(profileWxml, /open-type="chooseAvatar"/);
  assert.match(profileWxml, /type="nickname"/);
  assert.match(profileWxml, /设置头像、昵称/);
  assert.match(profileJs, /profileConfirmed:\s*false/);
  assert.match(profileJs, /profile\.profileCompleted === true/);
  assert.match(profileJs, /prepareAvatarUpload/);
  assert.match(profileJs, /wx\.getImageInfo/);
  assert.match(profileJs, /pendingAvatarUpload/);
  assert.match(profileJs, /\/api\/uploads\/image-file/);
  assert.match(profileJs, /uploadFile/);
  assert.match(requestJs, /wx\.uploadFile/);
  assert.doesNotMatch(profileJs, /头像读取失败，请重新选择/);
  assert.match(profileJs, /wx\.removeStorageSync\('lotteryToken'\)/);
  assert.match(profileWxml, /avatarPreparing/);
  assert.match(profileWxml, /正在处理头像/);
  assert.match(profileJs, /登录成功/);
  assert.doesNotMatch(profileJs, /title:\s*'资料已更新'/);
  assert.match(profileWxml, /点击设置头像和昵称后登录/);
  assert.match(profileJs, /\/api\/auth\/wechat-login/);
  assert.match(profileJs, /\/api\/me\/profile/);
  assert.match(profileJs, /\/api\/uploads\/image/);
  assert.match(profileJs, /\/api\/me\/overview/);
  assert.match(profileJs, /authenticated/);
  assert.doesNotMatch(profileJs, /nickname:\s*this\.data\.profile\.nickname/);
  assert.match(profileWxml, /asset-wallet/);
  assert.match(profileWxml, /asset-coupon/);
  assert.match(profileWxml, /asset-order/);
  assert.match(profileJs, /\/pages\/settings\/settings/);
  assert.match(profileJs, /\/pages\/messages\/messages/);
  assert.match(profileJs, /\/pages\/smart-promotion\/smart-promotion/);
  assert.match(profileJs, /\/pages\/creator-tools\/creator-tools\?mode=activities/);
  assert.match(profileJs, /\/pages\/creator-tools\/creator-tools\?mode=claims/);
  assert.match(profileJs, /\/pages\/creator-tools\/creator-tools\?mode=team/);
  assert.match(profileJs, /\/pages\/creator-tools\/creator-tools\?mode=blacklist/);
  assert.doesNotMatch(profileWxml, /心愿/);
  assert.doesNotMatch(profileWxml, />耳<|>\?<|>链<|广告|广告收益|立即试玩|寻道大千|付费升级/);
});

test('profile business entries are backed by real pages and server APIs', async () => {
  const appJson = JSON.parse(await readSource('miniprogram/app.json'));
  const serverJs = await readSource('server.js');
  const profileWxml = await readSource('miniprogram/pages/profile/profile.wxml');
  const profileJs = await readSource('miniprogram/pages/profile/profile.js');
  const detailWxml = await readSource('miniprogram/pages/detail/detail.wxml');
  const detailJs = await readSource('miniprogram/pages/detail/detail.js');
  for (const page of ['mall', 'smart-promotion', 'personal', 'partnership', 'creator-tools']) {
    assert.ok(appJson.pages.includes(`pages/${page}/${page}`));
    await readSource(`miniprogram/pages/${page}/${page}.js`);
    await readSource(`miniprogram/pages/${page}/${page}.wxml`);
  }
  for (const route of [
    '/api/mall', '/api/me/homepage', '/api/me/partnerships', '/api/me/creator-activities',
    '/api/me/claims', '/api/me/team', '/api/me/blacklist', '/api/me/prizes'
  ]) {
    assert.match(serverJs, new RegExp(route.replaceAll('/', '\\/')));
  }
  const creatorToolsJs = await readSource('miniprogram/pages/creator-tools/creator-tools.js');
  const creatorToolsWxml = await readSource('miniprogram/pages/creator-tools/creator-tools.wxml');
  assert.match(creatorToolsJs, /\/api\/me\/creator-activities/);
  assert.match(creatorToolsJs, /\/api\/me\/claims/);
  assert.match(creatorToolsJs, /\/api\/me\/team/);
  assert.match(creatorToolsJs, /\/api\/me\/blacklist/);
  assert.match(creatorToolsWxml, /bindtap="toggleClaim"/);
  assert.match(creatorToolsWxml, /bindtap="createInvitation"/);
  assert.match(creatorToolsWxml, /bindtap="addBlacklist"/);
  assert.equal(appJson.pages.includes('pages/wishes/wishes'), false);
  assert.doesNotMatch(profileWxml, /心愿|wishCount|data-key="wishes"/);
  assert.doesNotMatch(profileJs, /wishCount|pages\/wishes/);
  assert.doesNotMatch(detailWxml, /follow-btn|bindtap="follow"/);
  assert.doesNotMatch(detailJs, /async follow\(|\/follow/);
  assert.doesNotMatch(serverJs, /\/api\/me\/wishes|\/api\/activities\/:id\/follow|wishCount/);
  assert.doesNotMatch(profileWxml, /广告收益|付费升级/);
});

test('orders page presents payment states as user-facing Chinese text', async () => {
  const ordersJs = await readSource('miniprogram/pages/orders/orders.js');
  const ordersWxml = await readSource('miniprogram/pages/orders/orders.wxml');
  for (const text of ['待支付', '已支付', '已使用', '支付失败', '已退款']) {
    assert.match(ordersJs, new RegExp(text));
  }
  assert.match(ordersWxml, /statusText/);
  assert.doesNotMatch(ordersWxml, /\{\{item\.status\}\}/);
});

test('settings, messages, address and wallet pages use real platform and backend flows', async () => {
  const settingsJs = await readSource('miniprogram/pages/settings/settings.js');
  const settingsWxml = await readSource('miniprogram/pages/settings/settings.wxml');
  const messagesJs = await readSource('miniprogram/pages/messages/messages.js');
  const addressJs = await readSource('miniprogram/pages/address/address.js');
  const walletJs = await readSource('miniprogram/pages/wallet/wallet.js');
  const serverJs = await readSource('server.js');
  assert.match(settingsJs, /wx\.openSetting/);
  assert.match(settingsJs, /wx\.getUpdateManager/);
  assert.match(settingsJs, /\/api\/auth\/logout/);
  assert.match(settingsWxml, /open-type="feedback"/);
  assert.match(settingsWxml, /navMetrics\.navHeight/);
  assert.match(settingsWxml, /settings-back/);
  assert.match(messagesJs, /\/api\/me\/messages/);
  assert.match(addressJs, /wx\.chooseAddress/);
  assert.match(addressJs, /\/api\/me\/address/);
  assert.match(walletJs, /\/api\/me\/withdrawals/);
  assert.match(serverJs, /\/api\/admin\/withdrawals/);
  assert.doesNotMatch(`${settingsJs}\n${messagesJs}\n${addressJs}`, /已打开/);
});

test('member center data comes from backend without fixed demo profile numbers', async () => {
  const requestJs = await readSource('miniprogram/utils/request.js');
  const localApiJs = await readSource('miniprogram/utils/local-api.js');
  const serverJs = await readSource('server.js');
  const miniJs = await readSource('public/mini.js');
  assert.match(requestJs, /https:\/\/lottery\.example\.com/);
  assert.match(requestJs, /wx\.getStorageSync\('lotteryUseLocalBackend'\) === true/);
  assert.match(requestJs, /USE_LOCAL_BACKEND = ENV_VERSION === 'develop' && shouldUseLocalBackend\(\)/);
  assert.doesNotMatch(requestJs, /localRequest|local-api/);
  assert.doesNotMatch(`${localApiJs}\n${serverJs}`, /memberStats:\s*\{[\s\S]{0,120}total:\s*117|wallet:\s*\{[\s\S]{0,120}balance:\s*66\.6|coupons:\s*\[[\s\S]{0,120}coupon_1|orders:\s*\[[\s\S]{0,120}order_1/);
  assert.doesNotMatch(miniJs, /<strong>117<\/strong>|<strong>4<\/strong>|<strong>23<\/strong>|[¥楼]66\.60|3\s*张可用|2\s*条/);
  assert.match(requestJs, /refreshWechatSession/);
  assert.match(requestJs, /res\.statusCode === 401/);
  assert.match(requestJs, /performRequest\(path, options, true\)/);
});

test('subscription helper uses native WeChat subscription prompt when configured', async () => {
  const subscribeJs = await readSource('miniprogram/utils/subscribe.js');
  assert.match(subscribeJs, /wx\.requestSubscribeMessage/);
  assert.match(subscribeJs, /tmplIds/);
  assert.match(subscribeJs, /not_configured/);
  assert.doesNotMatch(subscribeJs, /预约成功|预约已保留/);
});

test('privacy authorization uses the native WeChat consent flow before private APIs', async () => {
  const appJson = JSON.parse(await readSource('miniprogram/app.json'));
  const appJs = await readSource('miniprogram/app.js');
  const privacyJs = await readSource('miniprogram/utils/privacy.js');
  const popupJs = await readSource('miniprogram/components/privacy-popup/privacy-popup.js');
  const popupWxml = await readSource('miniprogram/components/privacy-popup/privacy-popup.wxml');

  assert.equal(appJson.usingComponents['privacy-popup'], '/components/privacy-popup/privacy-popup');
  assert.deepEqual(appJson.requiredPrivateInfos, ['chooseLocation', 'getLocation']);
  assert.match(appJs, /initializePrivacyAuthorization/);
  assert.match(privacyJs, /wx\.onNeedPrivacyAuthorization/);
  assert.match(privacyJs, /wx\.requirePrivacyAuthorize/);
  assert.match(privacyJs, /exposureAuthorization/);
  assert.match(privacyJs, /event: 'disagree'/);
  assert.match(popupWxml, /open-type="agreePrivacyAuthorization"/);
  assert.match(popupWxml, /bindagreeprivacyauthorization="handleAgreePrivacyAuthorization"/);
  assert.match(popupWxml, /openPrivacyContract/);
  assert.match(popupJs, /wx\.openPrivacyContract/);
  assert.match(popupJs, /privacy-agree-button/);

  for (const page of ['index', 'profile', 'create', 'launch', 'detail', 'address']) {
    const wxml = await readSource(`miniprogram/pages/${page}/${page}.wxml`);
    assert.match(wxml, /<privacy-popup\s*\/>/);
  }
  for (const page of ['index', 'profile', 'create', 'launch', 'detail', 'address']) {
    const js = await readSource(`miniprogram/pages/${page}/${page}.js`);
    assert.match(js, /requirePrivacyAuthorization/);
  }
});

test('detail page uses concise reminder button labels', async () => {
  const detailWxml = await readSource('miniprogram/pages/detail/detail.wxml');
  const detailJs = await readSource('miniprogram/pages/detail/detail.js');
  const appWxss = await readSource('miniprogram/app.wxss');
  assert.match(detailWxml, /开奖提醒/);
  assert.doesNotMatch(detailWxml, /participantCount\s*\+\s*1110/);
  assert.match(detailWxml, /已开启提醒/);
  assert.doesNotMatch(detailWxml, /开奖时提醒我|已预约提醒/);
  assert.match(detailJs, /wx\.login/);
  assert.match(detailJs, /\/api\/auth\/wechat-login/);
  assert.match(detailJs, /wx\.getLocation/);
  assert.match(detailJs, /\/assist/);
  assert.match(detailWxml, /参与条件/);
  assert.doesNotMatch(detailWxml, /<official-account/);
  assert.match(detailWxml, /审核中/);
  assert.match(detailWxml, /sponsor-follow/);
  assert.match(detailWxml, /已关注/);
  assert.match(detailWxml, /detail-bottom \{\{activity\.promotion\.hideShareButton \? 'single' : ''\}\}/);
  assert.match(detailJs, /creator-subscription/);
  assert.match(detailWxml, /participantTicker/);
  assert.match(detailJs, /buildParticipantTicker\(activity\.participants\)/);
  assert.match(detailJs, /instantAttemptsRemaining/);
  assert.match(detailJs, /继续抽奖（剩余/);
  assert.match(detailJs, /恭喜中奖/);
  assert.match(detailJs, /本次未中奖/);
  assert.match(detailJs, /if \(!subscribeResult\.accepted\)/);
  assert.match(detailJs, /lotteryActivityRemindersV2/);
  assert.match(detailWxml, /{{drawRuleText}}/);
  assert.doesNotMatch(detailWxml, /不\*\*\*树|一\*\*\*生|真\*\*\*/);
  assert.doesNotMatch(detailJs, /quickLogin|lotteryUser|微信用户/);
  assert.match(appWxss, /\.join-btn\s*\{[^}]*display:\s*flex/);
  assert.match(appWxss, /\.join-btn\s*\{[^}]*align-items:\s*center/);
  assert.match(appWxss, /\.join-btn\s*\{[^}]*justify-content:\s*center/);
  assert.match(appWxss, /\.join-btn\s*\{[^}]*width:\s*420rpx/);
  assert.match(appWxss, /\.join-btn\s*\{[^}]*margin:\s*0 auto/);
  assert.match(appWxss, /\.join-btn\s*\{[^}]*line-height:\s*84rpx/);
  assert.match(appWxss, /\.detail-page[\s\S]*?padding-bottom:\s*calc\(/);
  assert.match(appWxss, /\.detail-bottom[\s\S]*?grid-template-columns:\s*240rpx 1fr/);
  assert.match(appWxss, /\.detail-bottom[\s\S]*?env\(safe-area-inset-bottom\)/);
  assert.match(appWxss, /\.detail-bottom button[\s\S]*?height:\s*84rpx/);
  const detailWxss = await readSource('miniprogram/pages/detail/detail.wxss');
  assert.match(detailWxss, /\.detail-bottom\.single\s*\{[^}]*grid-template-columns:\s*1fr/);
  assert.match(detailWxss, /\.sponsor-card \.organizer-name\s*\{[^}]*text-overflow:\s*ellipsis/);
});

test('web mini entry uses live data without browser-side fake interactions', async () => {
  const miniJs = await readSource('public/mini.js');
  const miniHtml = await readSource('public/mini.html');
  const stylesCss = await readSource('public/styles.css');
  assert.match(miniHtml, /微信小程序入口/);
  assert.match(miniHtml, /id="launchLink"/);
  assert.match(miniJs, /fetch\('\/api\/public\/entry'/);
  assert.match(miniJs, /fetch\('\/api\/home'/);
  assert.match(miniJs, /launchUrl/);
  assert.match(miniJs, /entry-activity/);
  assert.doesNotMatch(miniJs, /wx\.login|requestSubscribeMessage|Math\.random|localStorage/);
  assert.doesNotMatch(miniJs, /data-login|data-create-action|data-activity/);
  assert.match(stylesCss, /\.entry-shell\s*\{/);
  assert.match(stylesCss, /\.entry-launch\s*\{/);
});

test('admin activity form controls homepage placement and creates future-dated activities', async () => {
  const adminJs = await readSource('public/admin.js');
  assert.match(adminJs, /name="homePlacement"/);
  assert.match(adminJs, /value="official"/);
  assert.match(adminJs, /value="cash"/);
  assert.match(adminJs, /value="daily"/);
  assert.match(adminJs, /name="homePriority"/);
  assert.match(adminJs, /drawAt:\s*futureIso\(24\)/);
  assert.match(adminJs, /homePlacement:\s*'daily'/);
  assert.match(adminJs, /name="autoDraw"/);
  assert.match(adminJs, /autoDraw:\s*true/);
  assert.doesNotMatch(adminJs, /conditions\.checkIn|设置打卡任务/);
});

test('admin exposes moderation for comments and partnership applications', async () => {
  const adminHtml = await readSource('public/admin.html');
  const adminJs = await readSource('public/admin.js');
  assert.match(adminHtml, /data-admin-view="comments"/);
  assert.match(adminHtml, /data-admin-view="partnerships"/);
  assert.match(adminHtml, /id="commentRows"/);
  assert.match(adminHtml, /id="partnershipRows"/);
  assert.match(adminJs, /\/api\/admin\/comments/);
  assert.match(adminJs, /\/api\/admin\/partnerships/);
  assert.match(adminJs, /data-comment-status/);
  assert.match(adminJs, /data-partnership-status/);
});
