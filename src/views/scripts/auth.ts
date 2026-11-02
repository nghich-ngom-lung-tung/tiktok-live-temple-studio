(function () {
  const TOKEN_KEY = 'temple_rpc_token_v1';

  function getToken(): string {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch (_) {
      return '';
    }
  }

  function updateStatus(message: string, isError = false): void {
    const status = document.getElementById('authStatus');
    if (!status) return;
    status.textContent = message;
    status.dataset.state = isError ? 'error' : 'ok';
  }

  function setAuthenticatedUI(authenticated: boolean): void {
    const logoutButton = document.getElementById('btnLogout') as HTMLButtonElement | null;
    if (logoutButton) logoutButton.hidden = !authenticated;
  }

  function emitAuthChanged(): void {
    window.dispatchEvent(new CustomEvent('temple-auth-changed'));
  }

  async function authenticate(rawToken: unknown): Promise<boolean> {
    const value = String(rawToken || '').trim();
    if (value.length < 32) {
      throw new Error('Token cần ít nhất 32 ký tự. Lấy token trong cửa sổ chạy server.');
    }

    const response = await window.fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: value })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Không xác thực được RPC token');
    }

    localStorage.setItem(TOKEN_KEY, value);
    setAuthenticatedUI(true);
    updateStatus('Đã xác thực RPC cho trình duyệt này.');
    emitAuthChanged();
    return true;
  }

  async function authorizedFetch(url: RequestInfo | URL, options: RequestInit = {}): Promise<Response> {
    const headers = new Headers(options.headers || {});
    const value = getToken();
    if (value) headers.set('Authorization', `Bearer ${value}`);
    const response = await window.fetch(url, { ...options, headers });
    if (response.status === 401) {
      const hadToken = Boolean(getToken());
      localStorage.removeItem(TOKEN_KEY);
      setAuthenticatedUI(false);
      if (hadToken) {
        updateStatus('Token hết hạn hoặc không đúng. Hãy nhập lại token từ cửa sổ server.', true);
        emitAuthChanged();
      } else {
        updateStatus('Chưa xác thực.', false);
      }
    }
    return response;
  }

  async function fetchAudioBlobUrl(url: string): Promise<string> {
    const response = await authorizedFetch(url);
    if (!response.ok) throw new Error(`Không tải được audio (${response.status})`);
    return URL.createObjectURL(await response.blob());
  }

  function logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    setAuthenticatedUI(false);
    updateStatus('Đã xóa token khỏi trình duyệt.');
    emitAuthChanged();
  }

  async function checkToken(): Promise<boolean> {
    if (!getToken()) {
      setAuthenticatedUI(false);
      updateStatus('Nhập RPC token trong terminal để bật điều khiển.');
      return false;
    }
    try {
      const response = await authorizedFetch('/api/auth/status');
      if (!response.ok) {
        setAuthenticatedUI(false);
        return false;
      }
      setAuthenticatedUI(true);
      updateStatus('Đã xác thực RPC cho trình duyệt này.');
      return true;
    } catch (_) {
      setAuthenticatedUI(false);
      updateStatus('Không kiểm tra được RPC token.', true);
      return false;
    }
  }

  window.TempleAuth = {
    getToken,
    authenticate,
    fetch: authorizedFetch,
    fetchAudioBlobUrl,
    logout
  };

  const input = document.getElementById('rpcTokenInput') as HTMLInputElement | null;
  const button = document.getElementById('btnAuthenticate') as HTMLButtonElement | null;
  const logoutButton = document.getElementById('btnLogout') as HTMLButtonElement | null;

  if (button && input) {
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await authenticate(input.value);
        input.value = '';
      } catch (error) {
        updateStatus(error.message, true);
      } finally {
        button.disabled = false;
      }
    });
  }

  if (logoutButton) logoutButton.addEventListener('click', logout);

  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const urlToken = hashParams.get('token');
  if (urlToken) {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    authenticate(urlToken).catch((error) => updateStatus(error.message, true));
  } else {
    checkToken();
  }
})();
