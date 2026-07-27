const form = document.querySelector('#adminLoginForm');
const message = document.querySelector('#adminLoginMessage');

form.addEventListener('submit', async event => {
  event.preventDefault();
  const token = String(new FormData(form).get('token') || '').trim();
  message.textContent = '正在验证…';
  try {
    const response = await fetch('/api/admin/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const payload = await response.json();
    if (!response.ok || payload.code !== 0) throw new Error(payload.msg || '登录失败');
    window.location.replace('/admin');
  } catch (error) {
    message.textContent = error.message || '登录失败，请稍后再试。';
  }
});
