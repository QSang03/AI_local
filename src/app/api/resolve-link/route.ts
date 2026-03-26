import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  try {
    // We use method HEAD with redirect: manual to just get the Location header,
    // or just let fetch follow it natively and return the final url.
    // However, some servers might redirect multiple times. Let's just use redirect: 'follow'
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow', // fetch will follow standard 3xx redirects
    });
    
    // Some endpoints may not support HEAD, so fallback to GET
    if (!res.ok && res.status === 405) {
      const getRes = await fetch(url, { method: 'GET', redirect: 'follow' });
      return NextResponse.json({ url: getRes.url || url });
    }

    return NextResponse.json({ url: res.url || url });
  } catch (error) {
    console.error('Error resolving link:', error);
    // If fetch fails, return the original URL as a fallback
    return NextResponse.json({ url });
  }
}
