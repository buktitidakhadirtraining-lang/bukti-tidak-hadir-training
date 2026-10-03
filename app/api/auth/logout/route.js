// app/api/auth/logout/route.js
import { NextResponse } from 'next/server';
import { getSessionCookieOptions } from '../../../../lib/session.js';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ ok: true, message: 'Berhasil keluar' });

  // Hapus cookie login: kosongkan isinya dan langsung kedaluwarsakan
  response.cookies.set({
    ...getSessionCookieOptions(0),
    value: '',
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}