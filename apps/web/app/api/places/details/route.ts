import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get('placeId');

  if (!placeId) {
    return NextResponse.json({ error: 'placeId required' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Places not configured' }, { status: 500 });
  }

  const params = new URLSearchParams({
    place_id: placeId,
    key: apiKey,
    fields: 'address_components,geometry,formatted_address',
  });

  const res = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params}`
  );
  const data = await res.json();
  const result = data.result;

  if (!result) {
    return NextResponse.json({ error: 'Place not found' }, { status: 404 });
  }

  const components = result.address_components || [];
  const get = (type: string) =>
    components.find((c: any) => c.types.includes(type))?.long_name || '';
  const getShort = (type: string) =>
    components.find((c: any) => c.types.includes(type))?.short_name || '';

  return NextResponse.json({
    formattedAddress: result.formatted_address || '',
    addressLine1: `${get('street_number')} ${get('route')}`.trim(),
    city: get('locality') || get('sublocality_level_1') || get('administrative_area_level_2'),
    state: get('administrative_area_level_1'),
    zip: get('postal_code'),
    countryCode: getShort('country'),
    lat: result.geometry?.location?.lat,
    lng: result.geometry?.location?.lng,
  });
}
