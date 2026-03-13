import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

const OWNER_EMAILS = ['meetrj1386@gmail.com', 'shefalijain@gmail.com']

export async function POST(req: NextRequest) {
  // Verify admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !OWNER_EMAILS.includes(user.email || '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const productId = formData.get('product_id') as string | null

  if (!file || !productId) {
    return NextResponse.json({ error: 'Missing file or product_id' }, { status: 400 })
  }

  const serviceClient = createServiceRoleClient()
  const ext = file.name.split('.').pop()
  const path = `catalog/${productId}/${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await serviceClient.storage
    .from('product-images')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: urlData } = serviceClient.storage
    .from('product-images')
    .getPublicUrl(path)

  // Update catalog product
  await serviceClient.from('catalog_products').update({ image_url: urlData.publicUrl }).eq('id', productId)

  return NextResponse.json({ url: urlData.publicUrl })
}
