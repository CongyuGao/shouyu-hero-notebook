import { findHeroSkin } from '@/lib/skins';

// Public artwork proxy: only exact, pinned catalog assets may be fetched.
// It cannot fetch caller-supplied URLs, private uploads, or arbitrary hosts.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const skin = findHeroSkin(url.searchParams.get('id') || '');
  const size = url.searchParams.get('size') || 'image';
  if (!skin || !['image', 'thumbnail', 'avatar'].includes(size))
    return new Response('未找到这张皮肤海报', { status: 404 });
  const source = skin[size as 'image' | 'thumbnail' | 'avatar'];
  if (
    !/^https:\/\/raw\.githubusercontent\.com\/lengyibai\/wzry-material\/[a-f0-9]{40}\/heros\/[a-zA-Z0-9_\-]+\.(webp|png|jpg|jpeg)$/.test(
      source,
    )
  )
    return new Response('图片地址无效', { status: 404 });
  try {
    const upstream = await fetch(source, {
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
      cf: { cacheTtl: 604800, cacheEverything: true },
    });
    const type = upstream.headers.get('content-type') || '';
    if (!upstream.ok || !/^image\/(webp|png|jpeg)(;|$)/i.test(type))
      return new Response('海报暂时无法加载，请稍后重试', { status: 502 });
    return new Response(upstream.body, {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=604800, immutable',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'same-origin',
      },
    });
  } catch {
    return new Response('海报暂时无法加载，请稍后重试', { status: 502 });
  }
}
