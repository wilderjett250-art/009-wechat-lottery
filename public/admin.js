const summaryEl = document.querySelector('#summary');
const rowsEl = document.querySelector('#activityRows');
const detailTitle = document.querySelector('#detailTitle');
const detailStatus = document.querySelector('#detailStatus');
const detailBody = document.querySelector('#detailBody');
const toast = document.querySelector('#toast');
const activityWorkspace = document.querySelector('#activityWorkspace');
const withdrawalPanel = document.querySelector('#withdrawalPanel');
const withdrawalRows = document.querySelector('#withdrawalRows');
const integrationPanel = document.querySelector('#integrationPanel');
const integrationBody = document.querySelector('#integrationBody');
const commentPanel = document.querySelector('#commentPanel');
const commentRows = document.querySelector('#commentRows');
const partnershipPanel = document.querySelector('#partnershipPanel');
const partnershipRows = document.querySelector('#partnershipRows');
const adminTitle = document.querySelector('#adminTitle');
const adminDescription = document.querySelector('#adminDescription');

const state = {
  summary: null,
  activities: [],
  withdrawals: [],
  comments: [],
  partnerships: [],
  integrations: null,
  selectedId: '',
  detailTab: 'base',
  adminView: 'activities'
};

const imageOptions = [
  ['/assets/hero-oats-photo.jpg', '燕麦片'],
  ['/assets/cover-phone.svg', '手机'],
  ['/assets/cover-panda.svg', '治愈摆件'],
  ['/assets/cover-toy.svg', '潮玩'],
  ['/assets/cover-football.svg', '赛事'],
  ['/assets/cover-camera.svg', '相机'],
  ['/assets/cover-airpods.svg', '耳机'],
  ['/assets/cover-coffee.svg', '咖啡'],
  ['/assets/cover-fan.svg', '风扇']
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2100);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const payload = await response.json();
  if (response.status === 401) {
    window.location.replace('/admin');
    throw new Error('后台登录已失效');
  }
  if (!response.ok || payload.code !== 0) {
    throw new Error(payload.msg || '请求失败');
  }
  return payload.data;
}

function statusText(status) {
  return {
    draft: '筹备中',
    live: '进行中',
    drawn: '已开奖',
    ended: '已结束'
  }[status] || status;
}

function formatDateTimeLocal(value) {
  const date = value ? new Date(value) : new Date();
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoFromLocal(value) {
  return value ? new Date(value).toISOString() : new Date().toISOString();
}

function futureIso(hours = 24) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function selectedActivity() {
  return state.activities.find(item => item.id === state.selectedId) || state.activities[0];
}

async function loadAll(keepSelection = true) {
  const [summary, activities, withdrawals, integrations, comments, partnerships] = await Promise.all([
    api('/api/admin/summary'),
    api('/api/admin/activities'),
    api('/api/admin/withdrawals'),
    api('/api/admin/integrations'),
    api('/api/admin/comments'),
    api('/api/admin/partnerships')
  ]);
  state.summary = summary;
  state.activities = activities;
  state.withdrawals = withdrawals;
  state.integrations = integrations;
  state.comments = comments;
  state.partnerships = partnerships;
  if (!keepSelection || !state.activities.some(item => item.id === state.selectedId)) {
    state.selectedId = state.activities[0]?.id || '';
  }
  render();
}

function renderSummary() {
  const items = [
    ['活动总数', state.summary?.activityCount || 0],
    ['进行中', state.summary?.liveCount || 0],
    ['参与用户', state.summary?.participantCount || 0],
    ['中奖记录', state.summary?.winnerCount || 0],
    ['剩余奖品', state.summary?.remaining || 0]
  ];
  summaryEl.innerHTML = items.map(([label, value]) => `
    <div class="summary"><span>${label}</span><strong>${value}</strong></div>
  `).join('');
}

function renderRows() {
  rowsEl.innerHTML = state.activities.map(activity => `
    <tr class="${activity.id === state.selectedId ? 'selected' : ''}">
      <td>
        <strong>${escapeHtml(activity.title)}</strong><br />
        <span style="color:var(--muted);font-size:12px">${escapeHtml(activity.organizer || activity.subtitle)}</span>
      </td>
      <td><span class="status ${activity.status}">${statusText(activity.status)}</span></td>
      <td>${activity.metrics.participantCount}</td>
      <td>${activity.metrics.remainingPrizeCount}/${activity.metrics.prizeCount}</td>
      <td><button class="link" data-select="${activity.id}">查看</button></td>
    </tr>
  `).join('');
}

function renderImageOptions(selected) {
  return imageOptions.map(([value, label]) => `
    <option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>
  `).join('');
}

function checked(value) {
  return value ? 'checked' : '';
}

function renderBase(activity) {
  return `
    <form id="activityForm" class="form-grid">
      <label class="field wide"><span>活动名称</span><input name="title" value="${escapeHtml(activity.title)}" /></label>
      <label class="field"><span>副标题</span><input name="subtitle" value="${escapeHtml(activity.subtitle)}" /></label>
      <label class="field"><span>发起方</span><input name="organizer" value="${escapeHtml(activity.organizer || '')}" /></label>
      <label class="field wide"><span>封面文案</span><input name="coverText" value="${escapeHtml(activity.coverText)}" /></label>
      <label class="field wide"><span>活动说明</span><textarea name="description">${escapeHtml(activity.description)}</textarea></label>
      <label class="field"><span>封面图片</span><select name="image">${renderImageOptions(activity.image)}</select></label>
      <label class="field"><span>分享标题</span><input name="shareTitle" value="${escapeHtml(activity.shareTitle)}" /></label>
      <label class="field"><span>开始时间</span><input name="startAt" type="datetime-local" value="${formatDateTimeLocal(activity.startAt)}" /></label>
      <label class="field"><span>开奖时间</span><input name="drawAt" type="datetime-local" value="${formatDateTimeLocal(activity.drawAt)}" /></label>
      <label class="field"><span>首页栏目</span><select name="homePlacement">
        <option value="" ${!activity.homePlacement ? 'selected' : ''}>不在首页展示</option>
        <option value="official" ${activity.homePlacement === 'official' ? 'selected' : ''}>官方大奖</option>
        <option value="cash" ${activity.homePlacement === 'cash' ? 'selected' : ''}>现金红包</option>
        <option value="daily" ${activity.homePlacement === 'daily' ? 'selected' : ''}>今日奖品</option>
      </select></label>
      <label class="field"><span>首页排序</span><input name="homePriority" type="number" min="0" max="9999" value="${Number(activity.homePriority || 0)}" /></label>
      <label class="field wide"><span>参与规则</span><input name="rule" value="${escapeHtml(activity.rule)}" /></label>
      <label class="field wide"><span>详情提示</span><input name="sponsorText" value="${escapeHtml(activity.sponsorText || '')}" /></label>
      <label class="field wide"><span>引流信息</span><input name="leadInfo" value="${escapeHtml(activity.leadInfo || '')}" /></label>
      <div class="actions wide">
        <button class="btn" type="submit">保存活动</button>
        <button class="btn secondary" type="button" data-status="${activity.status === 'live' ? 'ended' : 'live'}">
          ${activity.status === 'live' ? '结束活动' : '发布活动'}
        </button>
        <button class="btn teal" type="button" data-draw="${activity.id}">立即开奖</button>
      </div>
    </form>
  `;
}

function renderRules(activity) {
  const promotion = activity.promotion || {};
  const conditions = activity.conditions || {};
  const advanced = activity.advanced || {};
  const special = activity.specialConfig || {};
  const annual = special.annual || {};
  return `
    <form id="rulesForm" class="form-grid">
      <h3 class="section-title wide">开奖与玩法</h3>
      <label class="field"><span>页面模板</span><input name="templateType" value="${escapeHtml(activity.templateType || '新样式')}" /></label>
      <label class="field"><span>开奖方式</span><select name="drawMode">
        <option value="time" ${activity.drawMode === 'time' ? 'selected' : ''}>按时间开奖</option>
        <option value="people" ${activity.drawMode === 'people' ? 'selected' : ''}>按人数开奖</option>
        <option value="instant" ${activity.drawMode === 'instant' ? 'selected' : ''}>即抽即中</option>
      </select></label>
      <label class="field"><span>开奖人数</span><input name="drawParticipantTarget" type="number" min="1" value="${Number(activity.drawParticipantTarget || 100)}" /></label>
      <label class="field"><span>每人抽奖次数</span><input name="instantPerUserLimit" type="number" min="1" max="5" value="${Number(activity.instantPerUserLimit || 1)}" /></label>
      <label class="field"><span>即抽即中人数上限</span><input name="instantParticipantLimit" type="number" min="5" value="${Number(activity.instantParticipantLimit || 100)}" /></label>
      <label class="check-field"><input name="unlockByPeople" type="checkbox" ${checked(activity.unlockByPeople)} /><span>按参与人数依次解锁奖品</span></label>
      <label class="check-field"><input name="autoDraw" type="checkbox" ${checked(activity.autoDraw !== false)} /><span>到达条件后自动开奖</span></label>

      <h3 class="section-title wide">分享与参与条件</h3>
      <div class="toggle-grid wide">
        <label class="check-field"><input name="promotion.encourageShare" type="checkbox" ${checked(promotion.encourageShare)} /><span>鼓励参与者分享</span></label>
        <label class="check-field"><input name="promotion.platformRecommend" type="checkbox" ${checked(promotion.platformRecommend)} /><span>允许平台推荐</span></label>
        <label class="check-field"><input name="promotion.hideShareButton" type="checkbox" ${checked(promotion.hideShareButton)} /><span>隐藏分享按钮</span></label>
        <label class="check-field"><input name="conditions.assist" type="checkbox" ${checked(conditions.assist)} /><span>参与后增加助力值</span></label>
        <label class="check-field"><input name="conditions.groupOnly" type="checkbox" ${checked(conditions.groupOnly)} /><span>仅群成员可参与</span></label>
        <label class="check-field"><input name="conditions.fansOnly" type="checkbox" ${checked(conditions.fansOnly)} /><span>公众号粉丝可参与</span></label>
        <label class="check-field"><input name="conditions.review" type="checkbox" ${checked(conditions.review)} /><span>先审核再参与</span></label>
        <label class="check-field"><input name="conditions.wecom" type="checkbox" ${checked(conditions.wecom)} /><span>加企业微信后参与</span></label>
        <label class="check-field"><input name="conditions.region" type="checkbox" ${checked(conditions.region)} /><span>指定区域用户可参与</span></label>
        <label class="check-field"><input name="conditions.survey" type="checkbox" ${checked(conditions.survey)} /><span>填写问卷后参与</span></label>
        <label class="check-field"><input name="conditions.task" type="checkbox" ${checked(conditions.task)} /><span>完成指定任务后参与</span></label>
        <label class="check-field"><input name="conditions.taskProofRequired" type="checkbox" ${checked(conditions.taskProofRequired !== false)} /><span>任务需上传截图凭证</span></label>
        <label class="check-field"><input name="conditions.answer" type="checkbox" ${checked(conditions.answer)} /><span>答题后参与</span></label>
        <label class="check-field"><input name="conditions.vote" type="checkbox" ${checked(conditions.vote)} /><span>投票后参与</span></label>
      </div>
      <label class="field wide"><span>参与前任务文案</span><input name="conditions.taskText" value="${escapeHtml(conditions.taskText || '')}" /></label>
      <label class="field"><span>任务最短时长（秒）</span><input name="conditions.taskDurationSeconds" type="number" min="3" max="3600" value="${Number(conditions.taskDurationSeconds || 15)}" /></label>
      <label class="field"><span>审核说明</span><input name="conditions.reviewPrompt" value="${escapeHtml(conditions.reviewPrompt || '')}" /></label>
      <label class="field"><span>公众号名称</span><input name="conditions.officialAccountName" value="${escapeHtml(conditions.officialAccountName || '')}" /></label>
      <label class="field"><span>企业微信名称</span><input name="conditions.wecomName" value="${escapeHtml(conditions.wecomName || '')}" /></label>
      <label class="field"><span>答题题目</span><input name="conditions.answerQuestion" value="${escapeHtml(conditions.answerQuestion || '')}" /></label>
      <label class="field"><span>正确答案</span><input name="conditions.answerValue" value="${escapeHtml(conditions.answerValue || '')}" /></label>
      <label class="field wide"><span>投票选项（逗号分隔）</span><input name="conditions.voteOptions" value="${escapeHtml((conditions.voteOptions || []).join('，'))}" /></label>

      <h3 class="section-title wide">高级功能</h3>
      <div class="toggle-grid wide">
        <label class="check-field"><input name="advanced.enabled" type="checkbox" ${checked(advanced.enabled)} /><span>启用高级功能</span></label>
        <label class="check-field"><input name="advanced.cleanDisplay" type="checkbox" ${checked(advanced.cleanDisplay)} /><span>纯净显示</span></label>
        <label class="check-field"><input name="advanced.exclusiveLanding" type="checkbox" ${checked(advanced.exclusiveLanding)} /><span>专属引流位</span></label>
        <label class="check-field"><input name="advanced.analytics" type="checkbox" ${checked(advanced.analytics)} /><span>抽奖数据统计</span></label>
        <label class="check-field"><input name="advanced.blockHighRisk" type="checkbox" ${checked(advanced.blockHighRisk)} /><span>阻拦高风险用户</span></label>
        <label class="check-field"><input name="advanced.comments" type="checkbox" ${checked(advanced.comments)} /><span>留言</span></label>
        <label class="check-field"><input name="advanced.futureSubscription" type="checkbox" ${checked(advanced.futureSubscription)} /><span>订阅以后发起的抽奖</span></label>
        <label class="check-field"><input name="advanced.recentWinnerBlock" type="checkbox" ${checked(advanced.recentWinnerBlock)} /><span>近期中奖者不可参与</span></label>
      </div>
      <label class="field"><span>近期范围（天）</span><input name="advanced.recentWinnerDays" type="number" min="1" max="30" value="${Number(advanced.recentWinnerDays || 30)}" /></label>
      <label class="field wide"><span>排除活动 ID（逗号分隔）</span><input name="advanced.recentWinnerActivityIds" value="${escapeHtml((advanced.recentWinnerActivityIds || []).join(','))}" /></label>

      <h3 class="section-title wide">抽奖样式</h3>
      <label class="field"><span>结果样式</span><select name="specialConfig.styleKey">
        ${[['', '标准'], ['wheel', '大转盘'], ['box', '抽码'], ['machine', '抽奖机'], ['stick', '抽签']].map(([value, label]) => `<option value="${value}" ${special.styleKey === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select></label>
      <label class="field"><span>公司名称</span><input name="specialConfig.annual.companyName" value="${escapeHtml(annual.companyName || '')}" /></label>
      <label class="field"><span>年会主题</span><input name="specialConfig.annual.activityTheme" value="${escapeHtml(annual.activityTheme || '')}" /></label>
      <label class="field wide"><span>指定身份名单（UnionID，逗号分隔）</span><input name="specialConfig.annual.candidateUnionIds" value="${escapeHtml((annual.candidateUnionIds || []).join('，'))}" /></label>
      <label class="field wide"><span>历史昵称名单（兼容已有活动）</span><input name="specialConfig.annual.candidateNames" value="${escapeHtml((annual.candidateNames || []).join('，'))}" /></label>
      <div class="actions wide"><button class="btn" type="submit">保存玩法与规则</button></div>
    </form>
  `;
}

function renderPrizes(activity) {
  return `
    <div class="admin-list">
      ${activity.prizes.map(prize => `
        <div class="admin-list-item">
          <img src="${escapeHtml(prize.image)}" alt="${escapeHtml(prize.name)}" />
          <div><strong>${escapeHtml(prize.name)}</strong><span>${escapeHtml(prize.type || prize.level)} · ${escapeHtml(prize.deliveryMethod || '发起人发货')}${Number(prize.faceValue || 0) > 0 ? ` · ¥${Number(prize.faceValue).toFixed(2)}` : ''}</span></div>
          <span class="status live">剩 ${prize.remaining}</span>
        </div>
      `).join('') || '<div class="empty">暂无奖品</div>'}
    </div>
    <form id="prizeForm" class="form-grid" style="margin-top:16px">
      <label class="field"><span>奖项</span><input name="level" value="幸运奖" /></label>
      <label class="field"><span>奖品名称</span><input name="name" value="咖啡券包" /></label>
      <label class="field"><span>奖品类型</span><select name="type"><option>奖品</option><option>优惠券</option><option>红包</option><option>兑换码</option><option>商城奖品</option></select></label>
      <label class="field"><span>面额</span><input name="faceValue" type="number" min="0" step="0.01" value="0" /></label>
      <label class="field"><span>数量</span><input name="quantity" type="number" min="1" value="5" /></label>
      <label class="field"><span>发放方式</span><select name="deliveryMethod"><option>发起人发货</option><option>中奖者到店领取</option><option>系统自动发放</option></select></label>
      <label class="field"><span>图片</span><select name="image">${renderImageOptions('/assets/cover-coffee.svg')}</select></label>
      <div class="actions wide"><button class="btn secondary" type="submit">添加奖品</button></div>
    </form>
  `;
}

function renderParticipants(activity) {
  const pending = (activity.participationApplications || []).filter(item => item.status === 'pending');
  const pendingTaskReviews = (activity.taskReviews || []).filter(item => item.status === 'pending');
  return `
    <div class="admin-list" style="margin-bottom:16px">
      ${pendingTaskReviews.map(task => `
        <div class="admin-list-item">
          <span class="avatar-dot" style="background:${task.memberAvatarColor}">${escapeHtml(task.memberNickname.slice(0, 1))}</span>
          <div>
            <strong>${escapeHtml(task.memberNickname)} 的任务凭证</strong>
            <span>${escapeHtml(task.proofNote || '已上传截图凭证')} · ${new Date(task.submittedAt || task.updatedAt).toLocaleString()}</span>
            ${task.proofId ? `<a class="link" href="/api/admin/activity-tasks/${encodeURIComponent(task.id)}/proof" target="_blank" rel="noopener">查看凭证图片</a>` : ''}
          </div>
          <div class="actions">
            <button class="btn teal" data-task-review="${task.id}" data-task-status="approved">通过</button>
            <button class="btn secondary" data-task-review="${task.id}" data-task-status="rejected">驳回</button>
          </div>
        </div>
      `).join('') || '<div class="empty">暂无待审核任务凭证</div>'}
    </div>
    <div class="admin-list" style="margin-bottom:16px">
      ${pending.map(application => `
        <div class="admin-list-item">
          <span class="avatar-dot" style="background:#f59e0b">审</span>
          <div>
            <strong>${escapeHtml(application.nickname)}</strong>
            <span>${escapeHtml((application.surveyAnswers || []).map(item => `${item.question}：${item.value}`).join('；') || '待审核参与申请')}</span>
          </div>
          <div class="actions">
            <button class="btn teal" data-application="${application.id}" data-review="approved">通过</button>
            <button class="btn secondary" data-application="${application.id}" data-review="rejected">拒绝</button>
          </div>
        </div>
      `).join('') || '<div class="empty">暂无待审核申请</div>'}
    </div>
    <div class="admin-list">
      ${(activity.participants || []).map(participant => `
        <div class="admin-list-item">
          <span class="avatar-dot" style="background:${participant.avatarColor}">${escapeHtml(participant.nickname.slice(0, 1))}</span>
          <div><strong>${escapeHtml(participant.nickname)}</strong><span>${escapeHtml((participant.surveyAnswers || []).map(item => `${item.question}：${item.value}`).join('；') || participant.phone || '微信便捷登录')}</span></div>
          <span>${new Date(participant.createdAt).toLocaleDateString()}</span>
        </div>
      `).join('') || '<div class="empty">暂无参与用户</div>'}
    </div>
  `;
}

function renderWinners(activity) {
  return `
    <div class="admin-list">
      ${(activity.winners || []).map(winner => `
        <div class="admin-list-item">
          <span class="avatar-dot" style="background:${winner.participant?.avatarColor || '#c80f2e'}">${escapeHtml((winner.participant?.nickname || '用').slice(0, 1))}</span>
          <div>
            <strong>${escapeHtml(winner.participant?.nickname || '')}</strong>
            <span>${escapeHtml(winner.prize?.level || '')} · ${escapeHtml(winner.prize?.name || '')}</span>
          </div>
          <button class="btn secondary" data-claim="${winner.id}" data-claimed="${winner.claimed ? '0' : '1'}">
            ${winner.claimed ? '已领取' : '标记领取'}
          </button>
        </div>
      `).join('') || '<div class="empty">暂无中奖记录</div>'}
    </div>
  `;
}

function renderDetail() {
  const activity = selectedActivity();
  if (!activity) {
    detailBody.innerHTML = '<div class="empty">暂无活动</div>';
    return;
  }
  detailTitle.textContent = activity.title;
  detailStatus.className = `status ${activity.status}`;
  detailStatus.textContent = statusText(activity.status);

  const detailTabs = [
    ['base', '基础设置'],
    ['rules', '玩法与规则'],
    ['prizes', '奖品'],
    ['participants', '参与'],
    ['winners', '中奖']
  ];
  let body = '';
  if (state.detailTab === 'base') body = renderBase(activity);
  if (state.detailTab === 'rules') body = renderRules(activity);
  if (state.detailTab === 'prizes') body = renderPrizes(activity);
  if (state.detailTab === 'participants') body = renderParticipants(activity);
  if (state.detailTab === 'winners') body = renderWinners(activity);

  detailBody.innerHTML = `
    <div class="split-tabs">
      ${detailTabs.map(([key, label]) => `<button data-detail-tab="${key}" class="${state.detailTab === key ? 'active' : ''}">${label}</button>`).join('')}
    </div>
    ${body}
  `;
}

function render() {
  renderSummary();
  renderRows();
  renderDetail();
  renderAdminView();
}

function withdrawalStatusText(status) {
  return { pending: '待处理', paid: '已完成', rejected: '已退回' }[status] || status;
}

function renderWithdrawals() {
  withdrawalRows.innerHTML = state.withdrawals.map(record => `
    <tr>
      <td><strong>${escapeHtml(record.memberNickname)}</strong></td>
      <td>¥${Math.abs(Number(record.amount || 0)).toFixed(2)}</td>
      <td>${new Date(record.createdAt).toLocaleString()}</td>
      <td><span class="status ${record.status === 'pending' ? 'draft' : record.status === 'paid' ? 'live' : 'ended'}">${withdrawalStatusText(record.status)}</span></td>
      <td>
        ${record.status === 'pending' ? `
          <button class="link" data-withdrawal="${record.id}" data-withdrawal-status="paid">确认完成</button>
          <button class="link danger-link" data-withdrawal="${record.id}" data-withdrawal-status="rejected">退回</button>
        ` : '已处理'}
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5"><div class="empty">暂无提现申请</div></td></tr>';
}

function renderIntegrations() {
  const official = state.integrations?.officialAccount || {};
  const wecom = state.integrations?.wecom || {};
  const subscriptions = state.integrations?.subscriptionTemplates || {};
  const subscriptionRows = [
    ['drawReminder', '开奖提醒'],
    ['drawResult', '开奖结果'],
    ['cash', '红包到账'],
    ['comment', '留言回复']
  ];
  integrationBody.innerHTML = `
    <div class="admin-list">
      <div class="admin-list-item">
        <span class="avatar-dot" style="background:${official.configured ? '#16a36a' : '#9ca3af'}">公</span>
        <div>
          <strong>公众号关注校验</strong>
          <span>${official.configured ? `${escapeHtml(official.name)} · 已记录 ${official.followerCount || 0} 名有效粉丝` : '服务器环境变量尚未配置完整'}</span>
          <span>回调地址：${escapeHtml(official.callbackPath || '')}</span>
        </div>
        <span class="status ${official.configured ? 'live' : 'draft'}">${official.configured ? '可用' : '待配置'}</span>
      </div>
      <div class="admin-list-item">
        <span class="avatar-dot" style="background:${wecom.configured ? '#16a36a' : '#9ca3af'}">企</span>
        <div>
          <strong>企业微信联系人校验</strong>
          <span>${wecom.configured ? `${escapeHtml(wecom.name)} · ${wecom.contactCount || 0} 名联系人 · ${wecom.groupCount || 0} 个客户群` : '服务器环境变量尚未配置完整'}</span>
        </div>
        ${wecom.configured ? '<button class="btn teal" data-sync-wecom>同步联系人</button>' : '<span class="status draft">待配置</span>'}
      </div>
      ${subscriptionRows.map(([key, label]) => {
        const configured = subscriptions[key]?.configured === true;
        return `<div class="admin-list-item">
          <span class="avatar-dot" style="background:${configured ? '#16a36a' : '#9ca3af'}">信</span>
          <div><strong>${label}订阅消息</strong><span>服务器模板字段与模板 ID 由部署环境统一配置</span></div>
          <span class="status ${configured ? 'live' : 'draft'}">${configured ? '可用' : '待配置'}</span>
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderComments() {
  commentRows.innerHTML = state.comments.map(comment => {
    const activity = state.activities.find(item => item.id === comment.activityId);
    const visible = comment.status !== 'hidden';
    return `
      <tr>
        <td><strong>${escapeHtml(comment.nickname || '微信用户')}</strong><br /><span class="table-sub">${new Date(comment.createdAt).toLocaleString()}</span></td>
        <td>${escapeHtml(activity?.title || comment.activityId)}</td>
        <td>${escapeHtml(comment.content)}</td>
        <td><span class="status ${visible ? 'live' : 'ended'}">${visible ? '展示中' : '已隐藏'}</span></td>
        <td><button class="link" data-comment="${comment.id}" data-comment-status="${visible ? 'hidden' : 'visible'}">${visible ? '隐藏' : '恢复'}</button></td>
      </tr>
    `;
  }).join('') || '<tr><td colspan="5"><div class="empty">暂无活动留言</div></td></tr>';
}

function partnershipStatusText(status) {
  return { pending: '待联系', contacted: '跟进中', completed: '已完成', rejected: '已关闭' }[status] || status;
}

function renderPartnerships() {
  partnershipRows.innerHTML = state.partnerships.map(application => `
    <tr>
      <td><strong>${escapeHtml(application.contactName)}</strong><br /><span class="table-sub">${escapeHtml(application.nickname || '')}</span></td>
      <td>${escapeHtml(application.company || '个人')}</td>
      <td>${escapeHtml(application.phone)}</td>
      <td>${escapeHtml(application.needs)}</td>
      <td><span class="status ${application.status === 'pending' ? 'draft' : application.status === 'completed' ? 'live' : 'ended'}">${partnershipStatusText(application.status)}</span></td>
      <td>
        ${application.status === 'pending' ? `<button class="link" data-partnership="${application.id}" data-partnership-status="contacted">开始跟进</button>` : ''}
        ${application.status === 'contacted' ? `<button class="link" data-partnership="${application.id}" data-partnership-status="completed">标记完成</button>` : ''}
        ${!['completed', 'rejected'].includes(application.status) ? `<button class="link danger-link" data-partnership="${application.id}" data-partnership-status="rejected">关闭</button>` : '已处理'}
      </td>
    </tr>
  `).join('') || '<tr><td colspan="6"><div class="empty">暂无推广合作申请</div></td></tr>';
}

function renderAdminView() {
  const viewNames = {
    activities: ['活动管理', '创建抽奖活动、配置规则并管理活动状态。'],
    prizes: ['奖品与开奖', '配置活动奖项、发放方式并执行开奖。'],
    participants: ['参与名单', '查看当前活动的参与用户。'],
    winners: ['中奖核销', '查看中奖结果并维护领取状态。'],
    withdrawals: ['提现处理', '处理用户提交的红包余额提现申请。'],
    integrations: ['微信能力', '查看公众号和企业微信服务端校验状态。'],
    comments: ['留言审核', '管理活动留言的展示状态。'],
    partnerships: ['合作申请', '查看并跟进用户提交的推广合作需求。']
  };
  const [title, description] = viewNames[state.adminView] || viewNames.activities;
  adminTitle.textContent = title;
  adminDescription.textContent = description;
  document.querySelectorAll('[data-admin-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.adminView === state.adminView);
  });
  const isWithdrawals = state.adminView === 'withdrawals';
  const isIntegrations = state.adminView === 'integrations';
  const isComments = state.adminView === 'comments';
  const isPartnerships = state.adminView === 'partnerships';
  activityWorkspace.hidden = isWithdrawals || isIntegrations || isComments || isPartnerships;
  withdrawalPanel.hidden = !isWithdrawals;
  integrationPanel.hidden = !isIntegrations;
  commentPanel.hidden = !isComments;
  partnershipPanel.hidden = !isPartnerships;
  if (isWithdrawals) renderWithdrawals();
  if (isIntegrations) renderIntegrations();
  if (isComments) renderComments();
  if (isPartnerships) renderPartnerships();
}

document.addEventListener('click', async event => {
  if (event.target.closest('[data-admin-logout]')) {
    try {
      await fetch('/api/admin/session', { method: 'DELETE' });
    } finally {
      window.location.replace('/admin');
    }
    return;
  }

  const adminView = event.target.closest('[data-admin-view]');
  if (adminView) {
    state.adminView = adminView.dataset.adminView;
    const detailTabs = { activities: 'base', prizes: 'prizes', participants: 'participants', winners: 'winners' };
    if (detailTabs[state.adminView]) state.detailTab = detailTabs[state.adminView];
    render();
    return;
  }

  const withdrawal = event.target.closest('[data-withdrawal]');
  if (withdrawal) {
    await api(`/api/admin/withdrawals/${withdrawal.dataset.withdrawal}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: withdrawal.dataset.withdrawalStatus })
    });
    await loadAll();
    showToast(withdrawal.dataset.withdrawalStatus === 'paid' ? '提现已确认完成' : '提现金额已退回');
    return;
  }

  const comment = event.target.closest('[data-comment]');
  if (comment) {
    await api(`/api/admin/comments/${comment.dataset.comment}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: comment.dataset.commentStatus })
    });
    await loadAll();
    showToast(comment.dataset.commentStatus === 'hidden' ? '留言已隐藏' : '留言已恢复展示');
    return;
  }

  const partnership = event.target.closest('[data-partnership]');
  if (partnership) {
    await api(`/api/admin/partnerships/${partnership.dataset.partnership}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: partnership.dataset.partnershipStatus })
    });
    await loadAll();
    showToast('合作申请状态已更新');
    return;
  }

  if (event.target.closest('[data-sync-wecom]')) {
    try {
      const result = await api('/api/admin/integrations/wecom/sync', { method: 'POST', body: '{}' });
      await loadAll();
      showToast(`已同步 ${result.synced} 名联系人和 ${result.groups} 个客户群`);
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  const select = event.target.closest('[data-select]');
  if (select) {
    state.selectedId = select.dataset.select;
    render();
    return;
  }

  const detailTab = event.target.closest('[data-detail-tab]');
  if (detailTab) {
    state.detailTab = detailTab.dataset.detailTab;
    renderDetail();
    return;
  }

  const review = event.target.closest('[data-application]');
  if (review) {
    await api(`/api/admin/participation-applications/${review.dataset.application}/review`, {
      method: 'POST',
      body: JSON.stringify({ status: review.dataset.review })
    });
    await loadAll();
    showToast(review.dataset.review === 'approved' ? '申请已通过并加入抽奖池' : '申请已拒绝');
    return;
  }

  const taskReview = event.target.closest('[data-task-review]');
  if (taskReview) {
    await api(`/api/admin/activity-tasks/${taskReview.dataset.taskReview}/review`, {
      method: 'POST',
      body: JSON.stringify({ status: taskReview.dataset.taskStatus })
    });
    await loadAll();
    showToast(taskReview.dataset.taskStatus === 'approved' ? '任务凭证已通过' : '任务凭证已驳回');
    return;
  }

  const status = event.target.closest('[data-status]');
  if (status) {
    const activity = selectedActivity();
    try {
      await api(`/api/admin/activities/${activity.id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: status.dataset.status })
      });
      await loadAll();
      showToast('状态已更新');
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  const draw = event.target.closest('[data-draw]');
  if (draw) {
    try {
      const winners = await api(`/api/admin/activities/${draw.dataset.draw}/draw`, {
        method: 'POST',
        body: JSON.stringify({ count: 1 })
      });
      state.detailTab = 'winners';
      await loadAll();
      showToast(`已抽出 ${winners[0].participant.nickname}`);
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  const claim = event.target.closest('[data-claim]');
  if (claim) {
    await api(`/api/admin/winners/${claim.dataset.claim}/claim`, {
      method: 'PUT',
      body: JSON.stringify({ claimed: claim.dataset.claimed === '1' })
    });
    await loadAll();
    showToast('领取状态已更新');
    return;
  }

  if (event.target.closest('#newActivityBtn')) {
    const activity = await api('/api/admin/activities', {
      method: 'POST',
      body: JSON.stringify({
        title: `新抽奖活动 ${state.activities.length + 1}`,
        subtitle: '社群福利',
        coverText: '配置奖品后即可邀请用户参与',
        organizer: '抽奖工具',
        image: '/assets/cover-coffee.svg',
        drawAt: futureIso(24),
        endAt: futureIso(24),
        homePlacement: 'daily',
        homePriority: 0,
        status: 'draft',
        autoDraw: true
      })
    });
    state.selectedId = activity.id;
    state.detailTab = 'base';
    await loadAll();
    showToast('活动已创建');
  }
});

document.addEventListener('submit', async event => {
  event.preventDefault();
  const activity = selectedActivity();
  if (!activity) return;

  if (event.target.id === 'activityForm') {
    const form = new FormData(event.target);
    const data = Object.fromEntries(form.entries());
    data.startAt = toIsoFromLocal(data.startAt);
    data.drawAt = toIsoFromLocal(data.drawAt);
    data.endAt = data.drawAt;
    data.homePriority = Number(data.homePriority || 0);
    data.organizerVerified = true;
    await api(`/api/admin/activities/${activity.id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    await loadAll();
    showToast('活动已保存');
    return;
  }

  if (event.target.id === 'rulesForm') {
    const form = new FormData(event.target);
    const value = name => String(form.get(name) || '').trim();
    const enabled = name => form.has(name);
    const data = {
      templateType: value('templateType'),
      drawMode: value('drawMode'),
      drawParticipantTarget: Number(value('drawParticipantTarget') || 0),
      instantPerUserLimit: Number(value('instantPerUserLimit') || 1),
      instantParticipantLimit: Number(value('instantParticipantLimit') || 5),
      unlockByPeople: enabled('unlockByPeople'),
      autoDraw: enabled('autoDraw'),
      promotion: {
        encourageShare: enabled('promotion.encourageShare'),
        platformRecommend: enabled('promotion.platformRecommend'),
        hideShareButton: enabled('promotion.hideShareButton')
      },
      conditions: {
        ...activity.conditions,
        assist: enabled('conditions.assist'),
        groupOnly: enabled('conditions.groupOnly'),
        fansOnly: enabled('conditions.fansOnly'),
        review: enabled('conditions.review'),
        wecom: enabled('conditions.wecom'),
        region: enabled('conditions.region'),
        survey: enabled('conditions.survey'),
        task: enabled('conditions.task'),
        taskProofRequired: enabled('conditions.taskProofRequired'),
        answer: enabled('conditions.answer'),
        vote: enabled('conditions.vote'),
        taskText: value('conditions.taskText'),
        taskDurationSeconds: Number(value('conditions.taskDurationSeconds') || 15),
        reviewPrompt: value('conditions.reviewPrompt'),
        officialAccountName: value('conditions.officialAccountName'),
        wecomName: value('conditions.wecomName'),
        answerQuestion: value('conditions.answerQuestion'),
        answerValue: value('conditions.answerValue'),
        voteOptions: value('conditions.voteOptions').split(/[,，]/).map(item => item.trim()).filter(Boolean)
      },
      advanced: {
        enabled: enabled('advanced.enabled'),
        cleanDisplay: enabled('advanced.cleanDisplay'),
        exclusiveLanding: enabled('advanced.exclusiveLanding'),
        analytics: enabled('advanced.analytics'),
        blockHighRisk: enabled('advanced.blockHighRisk'),
        comments: enabled('advanced.comments'),
        futureSubscription: enabled('advanced.futureSubscription'),
        recentWinnerBlock: enabled('advanced.recentWinnerBlock'),
        recentWinnerDays: Number(value('advanced.recentWinnerDays') || 30),
        recentWinnerActivityIds: value('advanced.recentWinnerActivityIds').split(/[,，]/).map(item => item.trim()).filter(Boolean)
      },
      specialConfig: {
        ...activity.specialConfig,
        styleKey: value('specialConfig.styleKey'),
        annual: {
          ...(activity.specialConfig?.annual || {}),
          companyName: value('specialConfig.annual.companyName'),
          activityTheme: value('specialConfig.annual.activityTheme'),
          candidateUnionIds: value('specialConfig.annual.candidateUnionIds').split(/[,，]/).map(item => item.trim()).filter(Boolean),
          candidateNames: value('specialConfig.annual.candidateNames').split(/[,，]/).map(item => item.trim()).filter(Boolean)
        }
      }
    };
    await api(`/api/admin/activities/${activity.id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    await loadAll();
    showToast('玩法与规则已保存');
    return;
  }

  if (event.target.id === 'prizeForm') {
    const form = new FormData(event.target);
    const data = Object.fromEntries(form.entries());
    data.quantity = Number(data.quantity || 1);
    data.faceValue = Number(data.faceValue || 0);
    await api(`/api/admin/activities/${activity.id}/prizes`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    await loadAll();
    showToast('奖品已添加');
  }
});

loadAll(false).catch(error => showToast(error.message));
