import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: seller } = await supabase
    .from('sellers')
    .select('id, plan')
    .eq('user_id', user.id)
    .single();

  if (!seller) return NextResponse.json({ error: 'Seller not found' }, { status: 404 });

  const formData = await request.formData();
  const imageFile = formData.get('image') as File;
  const removeBackground = formData.get('remove_background') === 'true';

  if (!imageFile) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  // Upload original to Supabase Storage
  const fileName = `${seller.id}/${Date.now()}-original.${imageFile.name.split('.').pop()}`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(fileName, imageFile, { contentType: imageFile.type });

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  const { data: { publicUrl: originalUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(fileName);

  let enhancedUrl = originalUrl;

  // Background removal via Remove.bg (Growth/Pro plans)
  if (removeBackground && seller.plan !== 'free') {
    const removeBgApiKey = process.env.REMOVEBG_API_KEY;
    if (removeBgApiKey) {
      const bgForm = new FormData();
      bgForm.append('image_file', imageFile);
      bgForm.append('size', 'auto');
      bgForm.append('bg_color', 'ffffff');

      const bgResponse = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: { 'X-Api-Key': removeBgApiKey },
        body: bgForm,
      });

      if (bgResponse.ok) {
        const bgBlob = await bgResponse.blob();
        const enhancedFileName = `${seller.id}/${Date.now()}-enhanced.png`;

        const { error: enhancedUploadError } = await supabase.storage
          .from('product-images')
          .upload(enhancedFileName, bgBlob, { contentType: 'image/png' });

        if (!enhancedUploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(enhancedFileName);
          enhancedUrl = publicUrl;
        }
      }
    }
  }

  return NextResponse.json({
    original_url: originalUrl,
    enhanced_url: enhancedUrl,
    background_removed: removeBackground && enhancedUrl !== originalUrl,
  });
}
