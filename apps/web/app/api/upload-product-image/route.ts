import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Verify the user is authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const productId = formData.get('product_id') as string | null

  if (!file || !productId) {
    return NextResponse.json({ error: 'Missing file or product_id' }, { status: 400 })
  }

  // Verify the user owns this product (or is admin)
  const { data: product } = await supabase
    .from('products')
    .select('seller_id')
    .eq('id', productId)
    .single()

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const { data: seller } = await supabase
    .from('sellers')
    .select('id')
    .eq('id', product.seller_id)
    .eq('user_id', user.id)
    .single()

  const OWNER_EMAILS = ['meetrj1386@gmail.com', 'shefalijain@gmail.com']
  const isOwner = OWNER_EMAILS.includes(user.email || '')

  if (!seller && !isOwner) {
    return NextResponse.json({ error: 'Not authorized for this product' }, { status: 403 })
  }

  // Upload via service role (bypasses storage RLS)
  const serviceClient = createServiceRoleClient()
  const ext = file.name.split('.').pop()
  const path = `${productId}/${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await serviceClient.storage
    .from('product-images')
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = serviceClient.storage
    .from('product-images')
    .getPublicUrl(path)

  // Update product images
  await serviceClient.from('products').update({ images: [urlData.publicUrl] }).eq('id', productId)

  return NextResponse.json({ url: urlData.publicUrl })
}
