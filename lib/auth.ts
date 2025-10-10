import { cookies } from "next/headers";
import { verifyJWT } from "./helpers/jose";

export async function getSession() {
  const cookie = await cookies();
  const secureCookie: boolean = process.env.BETTER_AUTH_URL?.startsWith('https://') || false;
  const cookiePrefix  = secureCookie ? '__Secure-' : '';
  const session_token = cookie.get(`${cookiePrefix}kapil.app.session_token`)?.value || '';
  const sessionData = cookie.get(`${cookiePrefix}kapil.app.sessionData`)?.value || '';
  if(!session_token || !sessionData) return null;
  try {
   const session =  await verifyJWT(sessionData) as Session
   return session
  } catch(e: any) {
    console.log(e)
    return null
  }
}

export type Session = {
  session: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    expiresAt: Date;
    token: string;
    ipAddress?: string | null | undefined | undefined;
    userAgent?: string | null | undefined | undefined
  },
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    image?: string | null | undefined | undefined;
    username?: string | null | undefined;
  }
}|null
