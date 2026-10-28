import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const maximum = 3 * 1024 * 1024;
const failed = (status: number) => new Response('PDF no disponible / PDF unavailable', {status, headers: {'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8'}});

/** Same public bucket and UUID paths as existing menus. No private bucket or arbitrary URL is accepted. */
export async function GET(_request: NextRequest, {params}: {params: Promise<{restaurant: string; file: string; name: string}>}) {
  const {restaurant, file, name} = await params;
  if (!uuid.test(restaurant) || !uuid.test(file) || !/^[a-z0-9-]{1,90}\.pdf$/.test(name)) return failed(404);
  try {
    const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) return failed(503);
    const upstream = await fetch(new URL(`/storage/v1/object/public/unomesa-public/${restaurant}/${file}.pdf`, origin), {redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000)});
    if (!upstream.ok || !upstream.body) { await upstream.body?.cancel(); return failed(upstream.status === 404 || upstream.status === 400 ? 404 : 502); }
    if (Number(upstream.headers.get('content-length')) > maximum) { await upstream.body.cancel(); return failed(502); }
    const reader = upstream.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const {done, value} = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maximum) { await reader.cancel(); return failed(502); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    const bytes = Buffer.concat(chunks);
    if (bytes.subarray(0, 5).toString() !== '%PDF-') return failed(502);
    return new Response(new Uint8Array(bytes), {headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${name}"`,
      'Content-Length': String(size),
      'Cache-Control': 'public, max-age=300, s-maxage=300',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex',
    }});
  } catch { return failed(502); }
}
