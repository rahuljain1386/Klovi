import { NextRequest, NextResponse } from 'next/server'

const imageCache = new Map<string, string | null>()

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('query')
  if (!query) {
    return NextResponse.json({ url: null })
  }

  // Check cache
  if (imageCache.has(query)) {
    return NextResponse.json({ url: imageCache.get(query) })
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
      imageCache.set(query, null)
      return NextResponse.json({ url: null })
    }

    const data = await res.json()
    const photo = data.photos?.[1] || data.photos?.[0]
    const url = photo?.src?.medium || null

    imageCache.set(query, url)
    return NextResponse.json({ url })
  } catch {
    imageCache.set(query, null)
    return NextResponse.json({ url: null })
  }
}
