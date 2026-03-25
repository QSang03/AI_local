import axios from "axios";

const AUTH_API_BASE_URL = (
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  ""
).replace(/\/$/, "");

export interface RetryableAxiosRequestConfig {
  _retry?: boolean;
  headers?: Record<string, string>;
}

export const apiClient = axios.create({
  baseURL: AUTH_API_BASE_URL || undefined,
  withCredentials: true,
});

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
      return;
    }

    if (token) {
      resolve(token);
    } else {
      reject(new Error("Missing refreshed token"));
    }
  });

  failedQueue = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = (error.config ?? {}) as RetryableAxiosRequestConfig;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (!originalRequest.headers) {
              originalRequest.headers = {};
            }
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((refreshError) => Promise.reject(refreshError));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(
          `${AUTH_API_BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true },
        );

        const nextToken = response.data?.access_token as string | undefined;
        if (!nextToken) {
          throw new Error("Missing access_token from refresh endpoint");
        }

        setAccessToken(nextToken);
        processQueue(null, nextToken);

        if (!originalRequest.headers) {
          originalRequest.headers = {};
        }
        originalRequest.headers.Authorization = `Bearer ${nextToken}`;

        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setAccessToken(null);

        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
