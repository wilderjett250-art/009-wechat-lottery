const launchLink = document.querySelector('#launchLink');
const launchHint = document.querySelector('#launchHint');
const activityList = document.querySelector('#activityList');
const activityUpdated = document.querySelector('#activityUpdated');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '开奖时间待定';
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

function flattenActivities(home) {
  const seen = new Set();
  return ['official', 'cash', 'today']
    .flatMap(key => Array.isArray(home?.[key]) ? home[key] : [])
    .filter(activity => {
      const id = String(activity?.id || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 12);
}

function renderActivities(activities) {
  if (!activities.length) {
    activityList.innerHTML = '<p class="entry-empty">当前没有可展示的进行中活动。</p>';
    return;
  }
  activityList.innerHTML = activities.map(activity => `
    <article class="entry-activity">
      <div>
        <h3>${escapeHtml(activity.title || '未命名活动')}</h3>
        <p>${escapeHtml(activity.organizer || '抽奖工具')} · ${escapeHtml(formatDate(activity.drawAt))}</p>
      </div>
      <span class="entry-status">${escapeHtml(activity.status === 'drawn' ? '已开奖' : '进行中')}</span>
    </article>
  `).join('');
}

async function loadEntry() {
  const [entryResponse, homeResponse] = await Promise.all([
    fetch('/api/public/entry'),
    fetch('/api/home')
  ]);
  const entryPayload = await entryResponse.json();
  const homePayload = await homeResponse.json();
  if (!entryResponse.ok || entryPayload.code !== 0) throw new Error(entryPayload.msg || '小程序入口状态读取失败');
  if (!homeResponse.ok || homePayload.code !== 0) throw new Error(homePayload.msg || '活动数据读取失败');

  if (entryPayload.data?.ready && entryPayload.data.launchUrl) {
    launchLink.href = entryPayload.data.launchUrl;
    launchLink.hidden = false;
    launchHint.textContent = '已配置正式小程序入口，点击后由微信处理打开。';
  } else {
    launchHint.textContent = '正式小程序入口将在平台配置完成后启用。';
  }
  renderActivities(flattenActivities(homePayload.data));
  activityUpdated.textContent = `同步于 ${new Intl.DateTimeFormat('zh-CN', { timeStyle: 'short' }).format(new Date())}`;
}

loadEntry().catch(error => {
  launchHint.textContent = error.message || '数据读取失败，请稍后重试。';
  activityList.innerHTML = '<p class="entry-empty">当前活动数据暂时无法读取。</p>';
  activityUpdated.textContent = '同步失败';
});
