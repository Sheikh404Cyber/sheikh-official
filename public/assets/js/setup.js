// One-time admin setup: reads ?token= from the URL and posts the chosen
// password to /api/auth/setup. The token itself never gets stored anywhere.

const token = new URLSearchParams(location.search).get('token');
const form = document.getElementById('setupForm');
const invalidBox = document.getElementById('setupInvalid');
const doneBox = document.getElementById('setupDone');

function showError(msg) {
  const box = document.getElementById('formError');
  box.textContent = msg;
  box.classList.add('show');
}

function showUsedOrExpired() {
  form.hidden = true;
  doneBox.hidden = true;
  document.getElementById('invalidTitle').textContent = 'Setup link already used or expired';
  document.getElementById('invalidText').textContent =
    'This one-time link is no longer valid. If you still need access, ask for a fresh setup link.';
  invalidBox.hidden = false;
}

if (!token) {
  invalidBox.hidden = false;
} else {
  form.hidden = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;
    if (password.length < 8) {
      showError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      showError('The two passwords do not match.');
      return;
    }
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.textContent = 'Setting password…';
    document.getElementById('formError').classList.remove('show');
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.status === 410) {
        showUsedOrExpired();
        return;
      }
      if (!res.ok || !out.ok) {
        showError(out.error || 'Something went wrong. Please try again.');
        btn.disabled = false;
        btn.textContent = 'Set Password';
        return;
      }
      form.hidden = true;
      doneBox.hidden = false;
    } catch {
      showError('Network error. Please check your connection and try again.');
      btn.disabled = false;
      btn.textContent = 'Set Password';
    }
  });
}
