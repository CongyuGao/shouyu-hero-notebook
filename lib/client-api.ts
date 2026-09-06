export async function readResponse<T>(response: Response): Promise<T> {
  let data: T & { error?: string };
  try {
    data = (await response.json()) as T & { error?: string };
  } catch {
    throw new Error('服务暂时未响应，请稍后重试');
  }
  if (!response.ok) throw new Error(data?.error || '请求失败，请重试');
  return data;
}
export function apiFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (typeof location !== 'undefined') {
    const path = location.pathname.replace(/\/$/, '');
    if (path === '/edit' || path === '/manage')
      headers.set('x-notebook-mode', path.slice(1));
  }
  return fetch(input, { ...init, headers, credentials: 'same-origin' });
}
