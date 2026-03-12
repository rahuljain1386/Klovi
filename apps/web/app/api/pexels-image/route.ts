import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

// Cache with 24-hour TTL
const imageCache = new Map<string, { url: string | null; ts: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('query')
  const productId = req.nextUrl.searchParams.get('product_id')
  if (!query) {
    return NextResponse.json({ url: null })
  }

  // Check cache (with TTL)
  const cached = imageCache.get(query)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    // Still persist if product_id provided and we have a URL
    if (productId && cached.url) {
      persistImage(productId, cached.url)
    }
    return NextResponse.json({ url: cached.url })
  }

  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ url: null })
  }

  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=square`,
      { headers: { Authorization: apiKey } }
    )

    if (!res.ok) {
      imageCache.set(query, { url: null, ts: Date.now() })
      return NextResponse.json({ url: null })
    }

    const data = await res.json()
    const photo = data.photos?.[1] || data.photos?.[0]
    const url: string | null = photo?.src?.medium || null

    imageCache.set(query, { url, ts: Date.now() })

    // Persist to product record so we never re-fetch
    if (productId && url) {
      persistImage(productId, url)
    }

    return NextResponse.json({ url })
  } catch {
    imageCache.set(query, { url: null, ts: Date.now() })
    return NextResponse.json({ url: null })
  }
}

/** Save fetched image URL to products.images (fire-and-forget, only if empty) */
function persistImage(productId: string, url: string) {
  try {
    const supabase = createServiceRoleClient()
    // Only update if images is empty (don't overwrite seller-uploaded images)
    supabase
      .from('products')
      .update({ images: [url] })
      .eq('id', productId)
      .or('images.is.null,images.eq.{}')
      .then(() => {})
  } catch {}
}
