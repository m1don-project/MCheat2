const API_BASE = '/api';
const AUTH_BASE = `${API_BASE}/auth`;

const storage = {
  get access() {
    return localStorage.getItem('accessToken');
  },
  set access(token) {
    token
      ? localStorage.setItem('accessToken', token)
      : localStorage.removeItem('accessToken');
  },
  get refresh() {
    return localStorage.getItem('refreshToken');
  },
  set refresh(token) {
    token
      ? localStorage.setItem('refreshToken', token)
      : localStorage.removeItem('refreshToken');
  },
  set user(user) {
    user
      ? localStorage.setItem('user', JSON.stringify(user))
      : localStorage.removeItem('user');
  }
};

const showToast = (message, type = 'info') => {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = `toast visible ${type}`;
  setTimeout(() => {
    toast.className = 'toast hidden';
  }, 3000);
};

const redirectToLogin = () => {
  storage.access = null;
  storage.refresh = null;
  storage.user = null;
  if (!location.pathname.endsWith('login.html')) {
    location.replace('login.html');
  }
};

const refreshAccessToken = async () => {
  if (!storage.refresh) return false;
  try {
    const response = await fetch(`${AUTH_BASE}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: storage.refresh })
    });
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    storage.access = data.accessToken;
    if (data.refreshToken) {
      storage.refresh = data.refreshToken;
    }
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
};

const apiFetch = async (url, options = {}) => {
  const targetUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
  const opts = {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...options
  };

  if (options.headers) {
    opts.headers = { ...opts.headers, ...options.headers };
  }

  if (opts.body && typeof opts.body !== 'string') {
    opts.body = JSON.stringify(opts.body);
  }

  if (storage.access) {
    opts.headers.Authorization = `Bearer ${storage.access}`;
  }

  let response = await fetch(targetUrl, opts);
  if (response.status === 401 && await refreshAccessToken()) {
    opts.headers.Authorization = `Bearer ${storage.access}`;
    response = await fetch(targetUrl, opts);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Ошибка запроса' }));
    throw new Error(error.message || 'Ошибка запроса');
  }
  return response.json();
};

const initCommon = () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        if (storage.refresh) {
          await fetch(`${AUTH_BASE}/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: storage.refresh })
          });
        }
      } catch (err) {
        console.warn(err);
      } finally {
        redirectToLogin();
      }
    });
  }
};

const initLoginPage = () => {
  const form = document.getElementById('loginForm');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const data = await fetch(`${AUTH_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then((res) => {
        if (!res.ok) {
          return res.json().then((body) => {
            throw new Error(body.message || 'Ошибка авторизации');
          });
        }
        return res.json();
      });

      storage.access = data.accessToken;
      storage.refresh = data.refreshToken;
      storage.user = data.user;
      showToast('Вход выполнен', 'success');
      setTimeout(() => location.replace('dashboard.html'), 500);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
};

const ensureAuth = () => {
  if (!storage.access || !storage.refresh) {
    redirectToLogin();
  }
};

const initDashboardPage = () => {
  ensureAuth();

  const statTotal = document.getElementById('statTotal');
  const statActive = document.getElementById('statActive');
  const statBlocked = document.getElementById('statBlocked');
  const activityTable = document.getElementById('activityTable');

  const loadStats = async () => {
    try {
      const stats = await apiFetch('/keys/stats');
      statTotal.textContent = stats.total || 0;
      statActive.textContent = stats.active || 0;
      statBlocked.textContent = stats.blocked || 0;
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const loadActivity = async () => {
    try {
      const rows = await apiFetch('/keys/activity/latest');
      if (!rows.length) {
        activityTable.innerHTML =
          '<tr><td colspan="4" class="muted">Нет данных</td></tr>';
        return;
      }
      activityTable.innerHTML = rows
        .map(
          (row) => `<tr>
            <td>${row.key_value}</td>
            <td>${row.hwid || '-'}</td>
            <td>${row.action}</td>
            <td>${new Date(row.created_at).toLocaleString()}</td>
          </tr>`
        )
        .join('');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  loadStats();
  loadActivity();
};

const initUsersPage = () => {
  ensureAuth();
  const table = document.getElementById('usersTable');
  const form = document.getElementById('createUserForm');

  const loadUsers = async () => {
    try {
      const users = await apiFetch('/users');
      if (!users.length) {
        table.innerHTML = '<tr><td colspan="5" class="muted">Нет данных</td></tr>';
        return;
      }
      table.innerHTML = users
        .map(
          (user) => `<tr>
            <td>${user.username}</td>
            <td><span class="badge">${user.role}</span></td>
            <td>${user.is_active ? 'Активен' : 'Выключен'}</td>
            <td>${new Date(user.created_at).toLocaleString()}</td>
            <td>
              <button class="btn ghost small user-toggle" data-id="${user.id}" data-active="${user.is_active ? 1 : 0}">
                ${user.is_active ? 'Выключить' : 'Включить'}
              </button>
            </td>
          </tr>`
        )
        .join('');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const formData = new FormData(form);
    const payload = {
      username: formData.get('username'),
      password: formData.get('password'),
      role: formData.get('role'),
      is_active: formData.get('is_active') === 'on'
    };
    try {
      await apiFetch('/users', { method: 'POST', body: payload });
      showToast('Пользователь создан', 'success');
      form.reset();
      loadUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  table.addEventListener('click', async (event) => {
    const btn = event.target.closest('.user-toggle');
    if (!btn) return;
    const id = btn.dataset.id;
    const isActive = btn.dataset.active === '1';
    try {
      await apiFetch(`/users/${id}/status`, {
        method: 'PUT',
        body: { is_active: !isActive }
      });
      showToast('Статус обновлён', 'success');
      loadUsers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  loadUsers();
};

const initKeysPage = () => {
  ensureAuth();
  const table = document.getElementById('keysTable');
  const historyTable = document.getElementById('historyTable');
  const historyLabel = document.getElementById('historyKeyLabel');
  const createForm = document.getElementById('createKeyForm');
  const searchInput = document.getElementById('keySearch');
  const statusFilter = document.getElementById('keyStatusFilter');
  const reloadBtn = document.getElementById('reloadKeysBtn');

  let currentHistoryKey = null;

  const loadKeys = async () => {
    const params = new URLSearchParams();
    if (searchInput.value) {
      params.append('search', searchInput.value);
    }
    if (statusFilter.value) {
      params.append('status', statusFilter.value);
    }

    const query = params.toString();
    const endpoint = query ? `/keys?${query}` : '/keys';
    try {
      const keys = await apiFetch(endpoint);
      if (!keys.length) {
        table.innerHTML = '<tr><td colspan="6" class="muted">Нет данных</td></tr>';
        return;
      }

      table.innerHTML = keys
        .map(
          (key) => `<tr data-key-id="${key.id}" data-key-value="${key.key_value}" data-blocked="${key.is_blocked ? 1 : 0}">
            <td><strong>${key.key_value}</strong></td>
            <td>${key.status}</td>
            <td>${key.expires_at ? new Date(key.expires_at).toLocaleString() : '—'}</td>
            <td>${key.hwid || '—'}</td>
            <td>${key.is_blocked ? 'Да' : 'Нет'}</td>
            <td class="actions">
              <button class="btn ghost small key-history">История</button>
              <button class="btn ghost small key-hwid">HWID</button>
              <button class="btn ghost small key-extend">Продлить</button>
              <button class="btn ${key.is_blocked ? 'primary' : 'ghost'} small key-block">
                ${key.is_blocked ? 'Разблок' : 'Блок'}
              </button>
            </td>
          </tr>`
        )
        .join('');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const loadHistory = async (id, keyValue) => {
    try {
      const history = await apiFetch(`/keys/${id}/history`);
      currentHistoryKey = id;
      historyLabel.textContent = keyValue;
      if (!history.length) {
        historyTable.innerHTML =
          '<tr><td colspan="4" class="muted">Нет записей</td></tr>';
        return;
      }

      historyTable.innerHTML = history
        .map((item) => {
          let meta = '';
          if (item.metadata) {
            try {
              const parsed = JSON.parse(item.metadata);
              meta = Object.entries(parsed)
                .map(([key, value]) => `${key}: ${value ?? ''}`)
                .join(', ');
            } catch (e) {
              meta = item.metadata;
            }
          }
          return `<tr>
            <td>${new Date(item.created_at).toLocaleString()}</td>
            <td>${item.hwid || '—'}</td>
            <td>${item.action}</td>
            <td><span class="small muted">${meta}</span></td>
          </tr>`;
        })
        .join('');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!createForm.checkValidity()) {
      createForm.reportValidity();
      return;
    }
    const formData = new FormData(createForm);
    const payload = Object.fromEntries(formData.entries());
    if (!payload.valid_days && !payload.expires_at) {
      showToast('Укажите срок действия', 'error');
      return;
    }
    payload.valid_days = payload.valid_days ? Number(payload.valid_days) : null;
    if (payload.expires_at) {
      const dt = new Date(payload.expires_at);
      if (!Number.isNaN(dt.getTime())) {
        payload.expires_at = dt.toISOString().slice(0, 19).replace('T', ' ');
      }
    }
    try {
      await apiFetch('/keys', { method: 'POST', body: payload });
      showToast('Ключ создан', 'success');
      createForm.reset();
      loadKeys();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  table.addEventListener('click', async (event) => {
    const row = event.target.closest('tr[data-key-id]');
    if (!row) return;
    const keyId = row.dataset.keyId;
    const keyValue = row.dataset.keyValue;

    if (event.target.closest('.key-history')) {
      loadHistory(keyId, keyValue);
      return;
    }

    if (event.target.closest('.key-block')) {
      const isBlocked = row.dataset.blocked === '1';
      try {
        await apiFetch(`/keys/${keyId}/block`, {
          method: 'PUT',
          body: { is_blocked: !isBlocked }
        });
        showToast('Статус ключа обновлён', 'success');
        loadKeys();
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }

    if (event.target.closest('.key-extend')) {
      const days = prompt('На сколько дней продлить?', '7');
      if (!days) return;
      try {
        await apiFetch(`/keys/${keyId}/extend`, {
          method: 'PUT',
          body: { days: Number(days) }
        });
        showToast('Срок продлён', 'success');
        loadKeys();
      } catch (err) {
        showToast(err.message, 'error');
      }
      return;
    }

    if (event.target.closest('.key-hwid')) {
      const hwid = prompt('Новый HWID (пусто чтобы сбросить):');
      try {
        await apiFetch(`/keys/${keyId}/hwid`, {
          method: 'PUT',
          body: { hwid }
        });
        showToast('HWID обновлён', 'success');
        loadKeys();
        if (currentHistoryKey === keyId) {
          loadHistory(keyId, keyValue);
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  const debounce = (fn, delay = 400) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  searchInput.addEventListener(
    'input',
    debounce(() => loadKeys(), 500)
  );
  statusFilter.addEventListener('change', loadKeys);
  reloadBtn.addEventListener('click', loadKeys);

  loadKeys();
};

document.addEventListener('DOMContentLoaded', () => {
  initCommon();
  const page = document.body.dataset.page;
  switch (page) {
    case 'login':
      initLoginPage();
      break;
    case 'dashboard':
      initDashboardPage();
      break;
    case 'users':
      initUsersPage();
      break;
    case 'keys':
      initKeysPage();
      break;
    default:
      break;
  }
});

