import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Users, TrendingUp, MapPin } from 'lucide-react';
import InterestForm from './interest-form';

interface Props { params: Promise<{ seller: string }>; }

export default async function InterestPage({ params }: Props) {
  const { seller: slug } = await params;
  const supabase = await createClient();
  const { data: page } = await supabase.from('interest_pages').select('*, sellers(business_name, city, avatar_url)').eq('slug', slug).eq('status', 'active').single();
  if (!page) notFound();

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-950 via-purple-900 to-indigo-950 text-white">
      <div className="max-w-lg mx-auto px-6 py-12">
        <Link href="/" className="text-xs text-purple-300 font-semibold tracking-wider mb-8 block">KLOVI</Link>
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-2xl bg-white/10 border border-purple-400/30 flex items-center justify-center text-4xl mx-auto mb-4">✨</div>
          <h1 className="font-display text-3xl font-black mb-2">{page.product_name}</h1>
          <div className="flex items-center justify-center gap-2 text-purple-300 text-sm">
            <MapPin className="w-4 h-4" /><span>{page.city}</span><span>by {(page.sellers as any)?.business_name}</span>
          </div>
        </div>
        {page.product_description && <p className="text-center text-purple-200 text-sm mb-8 leading-relaxed">{page.product_description}</p>}
        {page.ai_insights && (
          <div className="bg-white/5 border border-purple-400/20 rounded-2xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-purple-400" /><span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Market Insight</span></div>
            <p className="text-sm text-purple-100">{page.ai_insights}</p>
            {page.suggested_price && <div className="mt-3 text-xs text-purple-300">Suggested price: <span className="text-white font-semibold">₹{page.suggested_price}</span></div>}
          </div>
        )}
        <div className="bg-white/5 border border-purple-400/20 rounded-2xl p-5 mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-1"><Users className="w-5 h-5 text-purple-400" /><span className="font-display text-3xl font-black text-purple-300">{page.signup_count}</span></div>
          <p className="text-xs text-purple-400">{page.threshold_reached ? 'Threshold reached! Launching soon.' : `${page.threshold - page.signup_count} more signups to launch`}</p>
        </div>
        {!page.threshold_reached ? <InterestForm pageId={page.id} /> : (
          <div className="bg-green-500/20 border border-green-400/30 rounded-2xl p-6 text-center">
            <p className="text-lg font-semibold text-green-300 mb-1">Launching soon!</p>
            <p className="text-sm text-green-200/70">We&apos;ll notify you when orders open.</p>
          </div>
        )}
        <div className="text-center mt-12"><Link href="/" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">Powered by <span className="font-semibold">Klovi</span></Link></div>
      </div>
    </main>
  );
}
