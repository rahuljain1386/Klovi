import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// ---------------------------------------------------------------------------
// AI Menu / Product Catalog Extraction - from image or text
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = `Extract all products/menu items from this image. For each item return:
- name (string, required)
- description (string or null if not visible)
- price (number only, no currency symbols -- use 0 if price is not visible)
- category (string or null if not apparent)

Return ONLY a valid JSON array with no additional text, markdown, or explanation.
Example: [{"name": "Margherita Pizza", "description": "Classic tomato and mozzarella", "price": 12.99, "category": "Pizzas"}]

If the image is blurry, unreadable, or contains no product/menu items, return: {"error": "No items could be extracted", "products": []}`;

const TEXT_EXTRACTION_PROMPT = `Extract all products/menu items from the following text. For each item return:
- name (string, required)
- description (string or null if not provided)
- price (number only, no currency symbols -- use 0 if price is not mentioned)
- category (string or null if not apparent)
- variants (array of {name: string, price: number} or null if no variants)

Return ONLY a valid JSON array. No markdown, no explanation.`;

interface ExtractedProduct {
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  variants?: Array<{ name: string; price: number }> | null;
}

/**
 * Safely parse the OpenAI response into a product array.
 */
function parseProductResponse(raw: string): {
  products: ExtractedProduct[];
  error: string | null;
} {
  // Strip markdown code fences if present
  const cleaned = raw
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);

    // Handle error response from the model
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (parsed.error) {
        return { products: parsed.products || [], error: parsed.error };
      }
      // Single product wrapped in object -- normalize to array
      if (parsed.name) {
        return { products: [parsed], error: null };
      }
      // Object with a "products" key
      if (Array.isArray(parsed.products)) {
        return { products: parsed.products, error: null };
      }
    }

    if (Array.isArray(parsed)) {
      // Validate and clean each product
      const products: ExtractedProduct[] = parsed
        .filter((item: unknown) => item && typeof item === 'object' && (item as Record<string, unknown>).name)
        .map((item: Record<string, unknown>) => ({
          name: String(item.name).trim(),
          description: item.description ? String(item.description).trim() : null,
          price: typeof item.price === 'number' ? item.price : parseFloat(String(item.price)) || 0,
          category: item.category ? String(item.category).trim() : null,
          variants: Array.isArray(item.variants) ? item.variants : null,
        }));

      return { products, error: null };
    }

    return { products: [], error: 'Unexpected response format from AI' };
  } catch {
    return { products: [], error: 'Failed to parse AI response as JSON' };
  }
}

export async function POST(request: Request) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
  }

  const openai = new OpenAI({ apiKey: openaiKey });
  const contentType = request.headers.get('content-type') || '';

  try {
    // --- Handle multipart form data (image upload) ---------------------------
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('image') as File | null;

      if (!file) {
        return NextResponse.json(
          { error: 'No image file provided. Send a file with field name "image".' },
          { status: 400 },
        );
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `Unsupported image type: ${file.type}. Accepted: JPEG, PNG, WebP, GIF.` },
          { status: 400 },
        );
      }

      // Validate file size (max 20MB)
      const maxSize = 20 * 1024 * 1024;
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: 'Image too large. Maximum size is 20MB.' },
          { status: 400 },
        );
      }

      // Convert to base64 data URL for the Vision API
      const buffer = await file.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const dataUrl = `data:${file.type};base64,${base64}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: EXTRACTION_PROMPT,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract all products/menu items with prices from this image:' },
              { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
            ],
          },
        ],
        max_tokens: 4000,
        temperature: 0.1, // low temperature for structured extraction
      });

      const raw = completion.choices[0]?.message?.content || '[]';
      const { products, error: parseError } = parseProductResponse(raw);

      return NextResponse.json({
        products,
        count: products.length,
        source: 'image',
        ...(parseError && { warning: parseError }),
      });
    }

    // --- Handle JSON body (image_url or text content) ------------------------
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request. Send multipart/form-data with an image, or JSON with {type, content/image_url}.' },
        { status: 400 },
      );
    }

    const type = body.type as string | undefined;
    const content = body.content as string | undefined;
    const imageUrl = body.image_url as string | undefined;

    // Image URL extraction
    if (type === 'image' && imageUrl) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract all products/menu items with prices from this image:' },
              { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
            ],
          },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      });

      const raw = completion.choices[0]?.message?.content || '[]';
      const { products, error: parseError } = parseProductResponse(raw);

      return NextResponse.json({
        products,
        count: products.length,
        source: 'image_url',
        ...(parseError && { warning: parseError }),
      });
    }

    // Text extraction
    if (content) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: TEXT_EXTRACTION_PROMPT },
          { role: 'user', content: `Extract products from the following:\n\n${content}` },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      });

      const raw = completion.choices[0]?.message?.content || '[]';
      const { products, error: parseError } = parseProductResponse(raw);

      return NextResponse.json({
        products,
        count: products.length,
        source: 'text',
        ...(parseError && { warning: parseError }),
      });
    }

    return NextResponse.json(
      { error: 'No input provided. Send an image file (multipart), an image_url, or text content.' },
      { status: 400 },
    );
  } catch (error) {
    console.error('Menu extraction error:', error);

    // Provide a user-friendly error message
    if (error instanceof Error) {
      if (error.message?.includes('Could not process image')) {
        return NextResponse.json(
          { error: 'The image could not be processed. Please try a clearer image.', products: [] },
          { status: 422 },
        );
      }
      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        return NextResponse.json(
          { error: 'AI service is temporarily busy. Please try again in a moment.', products: [] },
          { status: 429 },
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to extract menu items. Please try again.', products: [] },
      { status: 500 },
    );
  }
}
