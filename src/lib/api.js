const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

const defaultHeaders = {
  'Content-Type': 'application/json',
};

async function apiRequest(path, { method = 'GET', body, token } = {}) {
  const headers = { ...defaultHeaders };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;

  try {
    data = await response.json();
  } catch (error) {
    data = null;
  }

  if (!response.ok) {
    const message =
      (data && (data.error || data.message)) || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
}

export const requestEmailVerificationCode = ({ email }) =>
  apiRequest('/auth/request-email-code', {
    method: 'POST',
    body: { email },
  });

export const registerWithEmail = ({ email, password, name, verificationCode }) =>
  apiRequest('/auth/register', {
    method: 'POST',
    body: { email, password, name, verificationCode },
  });

export const loginWithEmail = ({ email, password }) =>
  apiRequest('/auth/login', {
    method: 'POST',
    body: { email, password },
  });

export const loginWithGoogle = ({ idToken }) =>
  apiRequest('/auth/google', {
    method: 'POST',
    body: { idToken },
  });

export const createSession = ({ token, session }) =>
  apiRequest('/sessions', {
    method: 'POST',
    token,
    body: session,
  });

export const fetchSessions = ({ token, limit, offset, from, to, minDuration }) => {
  const searchParams = new URLSearchParams();
  if (limit) searchParams.set('limit', String(limit));
  if (offset) searchParams.set('offset', String(offset));
  if (from) searchParams.set('from', from);
  if (to) searchParams.set('to', to);
  if (minDuration) searchParams.set('minDuration', String(minDuration));
  const query = searchParams.toString();
  return apiRequest(`/sessions${query ? `?${query}` : ''}`, {
    method: 'GET',
    token,
  });
};

export const fetchEvents = ({ token, limit, offset, from, to, sessionKey }) => {
  const searchParams = new URLSearchParams();
  if (limit) searchParams.set('limit', String(limit));
  if (offset) searchParams.set('offset', String(offset));
  if (from) searchParams.set('from', from);
  if (to) searchParams.set('to', to);
  if (sessionKey) searchParams.set('sessionKey', sessionKey);
  const query = searchParams.toString();
  return apiRequest(`/events${query ? `?${query}` : ''}`, {
    method: 'GET',
    token,
  });
};

export const createEvent = ({ token, event }) =>
  apiRequest('/events', {
    method: 'POST',
    token,
    body: event,
  });

export default {
  requestEmailVerificationCode,
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  createSession,
  fetchSessions,
  fetchEvents,
  createEvent,
};
