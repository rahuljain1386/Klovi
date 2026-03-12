import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')
  const perPage = req.nextUrl.searchParams.get('per_page') || '4'

  if (!query) {
    return NextResponse.json({ error: 'Missing query parameter q' }, { status: 400 })
  }

  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Pexels API key not configured' }, { status: 500 })
  }

  try {
    const orientation = req.nextUrl.searchParams.get('orientation') || 'square'
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&orientation=${orientation}`,
      {
        headers: { Authorization: apiKey },
      }
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'Pexels API error', status: res.status }, { status: 502 })
    }

    const data = await res.json()

    const photos = (data.photos || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      src: (p.src as Record<string, string>)?.large2x || (p.src as Record<string, string>)?.large || (p.src as Record<string, string>)?.medium,
      medium: (p.src as Record<string, string>)?.medium,
      thumb: (p.src as Record<string, string>)?.tiny,
      alt: p.alt || query,
      photographer: p.photographer,
    }))

    return NextResponse.json({ photos })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch photos' }, { status: 500 })
  }
}
