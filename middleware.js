// middleware.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/meta'];

export async function middleware(request) {
  const { pathname, searchParams } = request.nextUrl;

  // Lewati static assets, favicon, API, dll
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const token =
    request.cookies.get('auth_token')?.value ||
    request.cookies.get('session_token')?.value;

  let isAuthenticated = false;

  if (token) {
    try {
      const secret = new TextEncoder().encode(
        process.env.SESSION_SECRET || 'sistem_ketidakhadiran_training_session_secret_default_key_2026_xyz_auth_32'
      );
      await jwtVerify(token, secret);
      isAuthenticated = true;
    } catch (e) {
      isAuthenticated = false;
    }
  }

  // Jika di halaman /login dan sudah login, arahkan ke /dashboard
  if (pathname === '/login') {
    if (isAuthenticated) {
      const redirectUrl = searchParams.get('redirect') || '/dashboard';
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    return NextResponse.next();
  }

  // Jika di root / arahkan ke /dashboard jika login atau ke /login jika belum
  if (pathname === '/') {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Jika mengakses halaman privat tapi belum login
  if (!isAuthenticated && !PUBLIC_PATHS.includes(pathname)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
