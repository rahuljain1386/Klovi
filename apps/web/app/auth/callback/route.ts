import { NextResponse } from 'next/server';
import { createServerClient as createSSRClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const cookieStore = await cookies();
    const supabase = createSSRClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as any);
            });
          },
        },
      }
    );

    const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && user) {
      // Check if seller profile exists, create if not (Google OAuth first-time)
      const { data: existing } = await supabase
        .from('sellers')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!existing) {
        // Use display name from Google, or email prefix
        const name = user.user_metadata?.full_name ||
                     user.user_metadata?.name ||
                     user.email?.split('@')[0] ||
                     'My Business';

        const slug = name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim();

        await supabase.from('sellers').insert({
          user_id: user.id,
          business_name: name,
          slug: slug + '-' + Date.now().toString(36),
          status: 'onboarding',
          plan: 'free',
          country: 'usa',
          language: 'en',
        });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Something went wrong, redirect to login
  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
