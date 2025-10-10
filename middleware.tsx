import { betterFetch } from '@better-fetch/fetch';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Session } from './lib/auth';
import { signJWT } from './lib/helpers/jose';

export async function middleware(request: NextRequest) {
  const production = process.env.NODE_ENV === 'production';
  const secureCookie: boolean = production;
  const cookiePrefix = secureCookie ? '__Secure-' : '';
  const session_token = request.cookies.get(`${cookiePrefix}kapil.app.session_token`)?.value || '';
  const sessionData = request.cookies.get(`${cookiePrefix}kapil.app.sessionData`)?.value || '';
  const midResponse = NextResponse.next();

  if (production && !session_token) {
    return NextResponse.redirect(new URL('/login?redirectTo=' + encodeURIComponent(request.nextUrl as unknown as string), process.env.BETTER_AUTH_URL!));
  }

  if (production && session_token && !sessionData) {
    const { data: session } = await betterFetch<Session>('/api/auth/get-session', {
      baseURL: process.env.BETTER_AUTH_URL,
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });

    if (production && !session) {
      return NextResponse.redirect(new URL('/login?redirectTo=' + encodeURIComponent(request.nextUrl as unknown as string), process.env.BETTER_AUTH_URL!));
    }

    if (production) {
      midResponse.cookies.set({
        name: `${cookiePrefix}kapil.app.sessionData`,
        value: await signJWT(session!),
        httpOnly: true,
        sameSite: 'lax',
        domain: process.env.NODE_ENV === 'production' ? '.kapil.app' : '.localhost',
        secure: process.env.NODE_ENV === 'production' ? true : false,
        expires: new Date(Date.now() + 1000 * 60 * 5),
        path: '/',
      });
    }
  }

  // Add this return statement
  return midResponse;
}

export const config = {
  matcher: ['/:path*'],
};
