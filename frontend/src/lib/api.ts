import axios from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// The access token lives only in memory - never localStorage/sessionStorage
// - so it can't be stolen by an XSS payload reading browser storage. It's
// lost on page refresh by design; refreshAccessToken() below recovers it
// from the httpOnly refresh cookie the browser still holds.
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // send/receive the httpOnly refresh-token cookie
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

// A 401 from any of these means "bad credentials" or "already logged out" -
// not "access token expired," so retrying after a refresh makes no sense
// for them (and for /auth/refresh itself, would recurse).
const NO_REFRESH_RETRY_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
  '/auth/forgot-password',
  '/auth/reset-password',
];

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  // Our refresh tokens are single-use (rotation) - if two requests each
  // failed with 401 at the same moment and both called /auth/refresh, the
  // second would present an already-rotated token, which the backend treats
  // as theft and revokes every session. Sharing one in-flight promise across
  // all concurrent callers avoids ever sending two refresh calls at once.
  if (!refreshPromise) {
    refreshPromise = axios
      .post<{ accessToken: string }>(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        setAccessToken(res.data.accessToken);
        return res.data.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const url = original?.url || '';
    const isRetryable = error.response?.status === 401 && original && !original._retry;
    const isAuthActionRoute = NO_REFRESH_RETRY_PATHS.some((path) => url.includes(path));

    if (isRetryable && !isAuthActionRoute) {
      original._retry = true;
      try {
        const token = await refreshAccessToken();
        original.headers.set('Authorization', `Bearer ${token}`);
        return api(original);
      } catch {
        setAccessToken(null);
      }
    }

    return Promise.reject(error);
  },
);
