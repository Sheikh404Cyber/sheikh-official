// Login + signup form handling (shared by /login and /signup).

function showError(msg) {
  const box = document.getElementById('formError');
  box.textContent = msg;
  box.classList.add('show');
}

async function submitAuth(formId, endpoint, payload, btnText) {
  const form = document.getElementById(formId);
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const data = payload(new FormData(form));
    btn.disabled = true;
    btn.textContent = btnText;
    document.getElementById('formError').classList.remove('show');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || !out.ok) {
        showError(out.error || 'Something went wrong. Please try again.');
        btn.disabled = false;
        btn.textContent = formId === 'loginForm' ? 'Login' : 'Create Account';
        return;
      }
      location.href = out.user && out.user.is_admin ? '/admin' : '/';
    } catch {
      showError('Network error. Please check your connection and try again.');
      btn.disabled = false;
      btn.textContent = formId === 'loginForm' ? 'Login' : 'Create Account';
    }
  });
}

submitAuth('loginForm', '/api/auth/login', (fd) => ({
  email: fd.get('email'),
  password: fd.get('password'),
}), 'Logging in…');

submitAuth('signupForm', '/api/auth/signup', (fd) => ({
  name: fd.get('name'),
  email: fd.get('email'),
  password: fd.get('password'),
}), 'Creating account…');
