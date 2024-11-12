'use server';

import { cookies } from 'next/headers';
import { type TAuth } from '@/lib/def';
import { createJwtToken, verifyJwtToken } from '@/lib/jwt-token';

// SessionCookie and authSessionToken expiration times (to be in sync)
const authSessionCookieMaxAge = 60 * 60 * 24; // 1 day

const authSessionCookie = {
  name: 'auth-session',
  options: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: authSessionCookieMaxAge,
  }
};

export async function createAuthSession(payload: TAuth) {
  try {
    const authSessionToken = await createJwtToken(payload);
    (await cookies()).set(authSessionCookie.name, authSessionToken, authSessionCookie.options);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error creating auth session:', error.message);
    } else {
      console.error('Unknown error creating auth session:', error);
    }
    return false;
  }
};

export async function verifyAuthSession() {
  const authSessionCookieToken = (await cookies()).get(authSessionCookie.name)?.value;
  if (!authSessionCookieToken) {
    return null;
  }
  const authSessionPayload = await verifyJwtToken(authSessionCookieToken);
  if (!authSessionPayload) {
    return null;
  };

  return authSessionPayload.payload as TAuth;
};

export async function deleteAuthSession() {
  try {
    (await cookies()).delete(authSessionCookie.name);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error deleting auth session cookie:', error.message);
    } else {
      console.error('Unknown error deleting auth session cookie:', error);
    }
    return false;
  }
};