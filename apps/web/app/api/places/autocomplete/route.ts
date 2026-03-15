import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get('input');
  const country = searchParams.get('country') || '';

  if (!input || input.length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Places not configured' }, { status: 500 });
  }

  const params = new URLSearchParams({
    input,
    key: apiKey,
    types: 'address',
    ...(country && { components: `country:${country}` }),
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`
  );
  const data = await res.json();

  const predictions = (data.predictions || []).map((p: any) => ({
    placeId: p.place_id,
    description: p.description,
    mainText: p.structured_formatting?.main_text || '',
    secondaryText: p.structured_formatting?.secondary_text || '',
  }));

  return NextResponse.json({ predictions });
}
