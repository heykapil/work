'use server'
import { Payload } from 'paseto-ts/lib/types';
import { decrypt, encrypt, sign, verify } from 'paseto-ts/v4';
// import { generateKeys } from 'paseto-ts/v4';

interface SignOption {
  addExp?: boolean;
  footer?: string;
}

const DefaultSignOption: SignOption = {
  addExp: true,
  footer: 'kapil.app'
};

export async function signPasetoToken(
  payload: Payload,
  options?: SignOption,
  key?: string
){
  try {
    const secretKey = key || process.env.PASETO_SECRET_KEY!;
    const token =  sign(secretKey, payload, options || DefaultSignOption);
    return token.slice(10); // Remove "v4.public." prefix
  } catch (e) {
    console.error('Sign Error:', e);
    return null;
  }
}

export async function verifyPasetoToken(
  token: string,
  key?: string
){
  try {
    const publicKey = key || process.env.PASETO_PUBLIC_KEY!;
    const encodedToken = `v4.public.${token}`;
    const { payload, footer } = verify(publicKey, encodedToken);
    return JSON.parse(JSON.stringify(payload));
  } catch (e) {
    console.error('Verify Error:', e);
    return null;
  }
}

export async function encryptTokenV4(
  payload: Payload,
  options?: SignOption
){
  try {
    const token = encrypt(
      process.env.PASETO_LOCAL_KEY_V4!,
      payload,
      options || DefaultSignOption
    );
    return token.slice(9);
  } catch (e) {
    console.error('Encrypt Error:', e);
    return null;
  }
}

export async function decryptTokenV4(
  token: string
) {
  try {
    const encodedToken = `v4.local.${token}`;
    const { payload, footer } = decrypt( process.env.PASETO_LOCAL_KEY_V4!, encodedToken);
    return JSON.parse(JSON.stringify(payload));
  } catch (e) {
    console.error('Decrypt Error:', e);
    return null;
  }
}


// export const { secretKey, publicKey } = generateKeys('public');
// export const localKey = generateKeys('local');
