'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Step = 'describe' | 'analyzing' | 'results' | 'live' | 'signup-first';

// ─── Mic Button ─────────────────────────────────────────────────────────────
function MicButton({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;
      chunks.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        const fd = new FormData();
        fd.append('audio', blob, 'recording.webm');
        fd.append('language', 'en');
        try {
          const res = await fetch('/api/ai/voice', { method: 'POST', body: fd });
          if (res.ok) { const { text } = await res.json(); if (text) onTranscript(text); }
        } catch { /* */ }
      };
      recorder.start();
      setRecording(true);
    } catch { /* mic denied */ }
  };

  const stopRecording = () => { mediaRecorder.current?.stop(); setRecording(false); };

  return (
    <button type="button" onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}
      className={`w-14 h-14 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${recording ? 'bg-rose-500 text-white scale-110 animate-pulse' : 'bg-white/10 text-purple-300 hover:bg-white/20'}`} title="Hold to speak">
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" />
      </svg>
    </button>
  );
}

export default function TestIdeaPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('describe');
  const [idea, setIdea] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('usa');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // AI results
  const [demandLevel, setDemandLevel] = useState('');
  const [demandSummary, setDemandSummary] = useState('');
  const [competitorLow, setCompetitorLow] = useState(0);
  const [competitorHigh, setCompetitorHigh] = useState(0);
  const [suggestedPrice, setSuggestedPrice] = useState(0);
  const [competitorAnalysis, setCompetitorAnalysis] = useState('');
  const [insight, setInsight] = useState('');
  const [productName, setProductName] = useState('');
  const [pivotSuggestions, setPivotSuggestions] = useState<string[]>([]);

  // Interest page
  const [interestSlug, setInterestSlug] = useState('');
  const [signupCount, setSignupCount] = useState(0);

  const currencySymbol = country === 'india' ? '\u20B9' : '$';

  // Resume flow after signup — if saved test idea data exists and user is logged in
  useEffect(() => {
    const saved = localStorage.getItem('klovi_test_idea');
    if (!saved) return;

    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Restore saved state
      try {
        const data = JSON.parse(saved);
        setIdea(data.idea || '');
        setCity(data.city || '');
        setCountry(data.country || 'usa');
        setDemandLevel(data.demandLevel || '');
        setDemandSummary(data.demandSummary || '');
        setCompetitorLow(data.competitorLow || 0);
        setCompetitorHigh(data.competitorHigh || 0);
        setSuggestedPrice(data.suggestedPrice || 0);
        setCompetitorAnalysis(data.competitorAnalysis || '');
        setInsight(data.insight || '');
        setProductName(data.productName || '');
        setPivotSuggestions(data.pivotSuggestions || []);
        localStorage.removeItem('klovi_test_idea');

        // Auto-create the interest page
        setStep('results');
      } catch {
        localStorage.removeItem('klovi_test_idea');
      }
    })();
  }, []);

  const checkDemand = async () => {
    if (!idea.trim() || !city.trim()) {
      setError('Tell us what you want to sell and where you are');
      return;
    }
    setError('');
    setStep('analyzing');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/demand-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: idea, city, country }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      setDemandLevel(data.demand_level || 'MEDIUM');
      setDemandSummary(data.demand_summary || '');
      setCompetitorLow(data.competitor_price_low || 0);
      setCompetitorHigh(data.competitor_price_high || 0);
      setSuggestedPrice(data.suggested_price || 0);
      setCompetitorAnalysis(data.competitor_analysis || '');
      setInsight(data.insight || '');
      setProductName(data.product_name || idea.split(' ').slice(0, 3).join(' '));
      setPivotSuggestions(data.pivot_suggestions || []);
      setStep('results');
    } catch {
      setError('Something went wrong. Please try again.');
      setStep('describe');
    }
    setLoading(false);
  };

  const createInterestPage = async () => {
    // Check if user is logged in
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Save idea data to localStorage so we can resume after signup
      localStorage.setItem('klovi_test_idea', JSON.stringify({
        idea, city, country, demandLevel, demandSummary,
        competitorLow, competitorHigh, suggestedPrice,
        competitorAnalysis, insight, productName, pivotSuggestions,
      }));
      setStep('signup-first');
      return;
    }

    await createPageForUser(user.id);
  };

  const createPageForUser = async (userId: string) => {
    setLoading(true);
    const supabase = createClient();

    // Get or create seller record
    let { data: seller } = await supabase.from('sellers').select('id').eq('user_id', userId).single();

    if (!seller) {
      const slug = productName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim() || 'my-business';

      const { data: newSeller } = await supabase.from('sellers').insert({
        user_id: userId,
        business_name: productName,
        slug,
        status: 'aspiring',
        plan: 'free',
        country,
        language: 'en',
        city,
        phone: '',
        category: 'food',
        description: idea,
      }).select('id').single();
      seller = newSeller;
    }

    if (!seller) {
      setError('Could not create your account. Please try again.');
      setLoading(false);
      return;
    }

    // Create interest page
    const pageSlug = productName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    // Check if slug exists, append random if needed
    const { data: existing } = await supabase.from('interest_pages').select('id').eq('slug', pageSlug).single();
    const finalSlug = existing ? `${pageSlug}-${Math.random().toString(36).slice(2, 6)}` : pageSlug;

    const { data: page, error: pageError } = await supabase.from('interest_pages').insert({
      seller_id: seller.id,
      slug: finalSlug,
      product_name: productName,
      product_description: idea,
      city,
      demand_level: demandLevel,
      suggested_price: suggestedPrice,
      competitor_analysis: competitorAnalysis,
      ai_insights: insight,
      signup_count: 0,
      threshold: 10,
      threshold_reached: false,
      status: 'active',
      pivot_suggestions: pivotSuggestions,
    }).select('slug').single();

    if (pageError || !page) {
      setError('Could not create your page. Please try again.');
      setLoading(false);
      return;
    }

    setInterestSlug(page.slug);
    setStep('live');
    setLoading(false);
  };

  const tryPivot = (suggestion: string) => {
    setIdea(suggestion);
    setStep('describe');
  };

  const demandColor = demandLevel === 'HIGH' ? 'text-green-400' : demandLevel === 'MEDIUM' ? 'text-yellow-400' : 'text-rose-400';
  const demandBg = demandLevel === 'HIGH' ? 'bg-green-500/20 border-green-400/30' : demandLevel === 'MEDIUM' ? 'bg-yellow-500/20 border-yellow-400/30' : 'bg-rose-500/20 border-rose-400/30';

  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-950 via-purple-900 to-indigo-950 text-white">
      <div className="max-w-lg mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="text-xs text-purple-300 font-semibold tracking-wider">KLOVI</Link>
          <Link href="/auth/login" className="text-xs text-purple-400 hover:text-purple-300">Already selling? Log in</Link>
        </div>

        {/* ─── Step 1: Describe Your Idea ──────────────────────────── */}
        {step === 'describe' && (
          <div>
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">💭</div>
              <h1 className="font-display text-3xl font-black mb-2">Test your idea</h1>
              <p className="text-purple-300 text-sm">Zero risk. Zero investment. Find out if people want what you make — before you spend a single penny.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2 block">What do you want to sell?</label>
                <div className="flex gap-3">
                  <input type="text" value={idea} onChange={(e) => setIdea(e.target.value)}
                    className="flex-1 bg-white/10 border border-purple-400/30 rounded-xl px-4 py-4 text-base placeholder-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                    placeholder='e.g., "Homemade biryani, Hyderabadi style, serves 4"' autoFocus />
                  <MicButton onTranscript={(text) => setIdea(prev => prev ? `${prev}, ${text}` : text)} />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2 block">Where are you based?</label>
                <div className="flex gap-3">
                  <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
                    className="flex-1 bg-white/10 border border-purple-400/30 rounded-xl px-4 py-4 text-base placeholder-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                    placeholder="e.g., Mumbai, Austin TX" />
                  <MicButton onTranscript={(text) => setCity(text)} />
                </div>
              </div>

              <div className="flex gap-2">
                {[
                  { code: 'usa', flag: '\uD83C\uDDFA\uD83C\uDDF8', label: 'USA' },
                  { code: 'india', flag: '\uD83C\uDDEE\uD83C\uDDF3', label: 'India' },
                ].map(c => (
                  <button key={c.code} onClick={() => setCountry(c.code)}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${country === c.code ? 'bg-purple-500/40 border border-purple-400/60 text-white' : 'bg-white/5 border border-white/10 text-purple-400'}`}>
                    {c.flag} {c.label}
                  </button>
                ))}
              </div>

              {error && <p className="text-rose-400 text-sm text-center">{error}</p>}

              <button onClick={checkDemand} disabled={loading || !idea.trim() || !city.trim()}
                className="w-full py-5 bg-purple-500 hover:bg-purple-400 text-white rounded-2xl font-semibold text-lg transition-colors disabled:opacity-40 min-h-[60px]">
                Check Demand
              </button>

              <p className="text-center text-purple-400/60 text-xs">No signup required. Totally free.</p>
            </div>
          </div>
        )}

        {/* ─── Step 2: Analyzing ──────────────────────────────────── */}
        {step === 'analyzing' && (
          <div className="text-center py-16">
            <div className="inline-block w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mb-6" />
            <h2 className="font-display text-2xl font-black mb-2">Checking demand in {city}...</h2>
            <p className="text-purple-300 text-sm">Analyzing local market, competitors, and pricing</p>
          </div>
        )}

        {/* ─── Step 3: Results ────────────────────────────────────── */}
        {step === 'results' && (
          <div>
            <div className="text-center mb-6">
              <div className="text-5xl mb-3">{demandLevel === 'HIGH' ? '\uD83D\uDD25' : demandLevel === 'MEDIUM' ? '\uD83D\uDCA1' : '\uD83E\uDD14'}</div>
              <h2 className="font-display text-2xl font-black mb-1">Your Market Analysis</h2>
              <p className="text-purple-300 text-sm">{productName} in {city}</p>
            </div>

            {/* Demand Level */}
            <div className={`${demandBg} border rounded-2xl p-5 mb-4 text-center`}>
              <p className="text-xs text-purple-300 uppercase tracking-wider font-semibold mb-1">Demand Level</p>
              <p className={`font-display text-4xl font-black ${demandColor}`}>{demandLevel}</p>
              {demandSummary && <p className="text-sm text-purple-200 mt-2">{demandSummary}</p>}
            </div>

            {/* Pricing */}
            <div className="bg-white/5 border border-purple-400/20 rounded-2xl p-5 mb-4">
              <p className="text-xs text-purple-300 uppercase tracking-wider font-semibold mb-3">Pricing in Your Area</p>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-purple-300">Competitors charge:</span>
                <span className="font-semibold text-white">{currencySymbol}{competitorLow} — {currencySymbol}{competitorHigh}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-purple-300">Suggested price for you:</span>
                <span className="font-display text-2xl font-black text-purple-300">{currencySymbol}{suggestedPrice}</span>
              </div>
            </div>

            {/* AI Insight */}
            <div className="bg-white/5 border border-purple-400/20 rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-purple-400">&#x1F4CA;</span>
                <span className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Market Insight</span>
              </div>
              <p className="text-sm text-purple-100 leading-relaxed">{insight}</p>
              {competitorAnalysis && <p className="text-sm text-purple-200/70 mt-2 leading-relaxed">{competitorAnalysis}</p>}
            </div>

            {/* Potential revenue */}
            <div className="bg-purple-500/20 border border-purple-400/30 rounded-2xl p-5 mb-4 text-center">
              <p className="text-xs text-purple-300 uppercase tracking-wider font-semibold mb-1">If 10 people sign up</p>
              <p className="font-display text-3xl font-black text-purple-300">
                {currencySymbol}{suggestedPrice * 10}
              </p>
              <p className="text-xs text-purple-400 mt-1">potential first-weekend revenue</p>
            </div>

            {/* CTA */}
            <button onClick={createInterestPage} disabled={loading}
              className="w-full py-5 bg-purple-500 hover:bg-purple-400 text-white rounded-2xl font-semibold text-lg transition-colors disabled:opacity-50 min-h-[60px] mb-3">
              {loading ? 'Creating your page...' : 'Create my interest page — free'}
            </button>
            <p className="text-center text-purple-400/60 text-xs mb-6">Share it to see if people actually want this. Zero cost.</p>

            {/* Pivot suggestions (always shown, especially useful for LOW demand) */}
            {pivotSuggestions.length > 0 && demandLevel !== 'HIGH' && (
              <div className="bg-white/5 border border-purple-400/20 rounded-2xl p-5">
                <p className="text-xs text-purple-300 uppercase tracking-wider font-semibold mb-3">
                  {demandLevel === 'LOW' ? 'Consider trying instead' : 'Other ideas to explore'}
                </p>
                <div className="space-y-2">
                  {pivotSuggestions.map((s, i) => (
                    <button key={i} onClick={() => tryPivot(s)}
                      className="w-full text-left bg-white/5 hover:bg-white/10 border border-purple-400/20 rounded-xl px-4 py-3 text-sm text-purple-200 transition-colors flex items-center gap-3">
                      <span className="text-purple-400">&#x1F527;</span> {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => setStep('describe')} className="w-full text-purple-400 mt-4 text-sm hover:text-purple-300">
              Try a different idea
            </button>

            {error && <p className="text-rose-400 text-sm text-center mt-3">{error}</p>}
          </div>
        )}

        {/* ─── Signup Gate ────────────────────────────────────────── */}
        {step === 'signup-first' && (
          <div className="text-center">
            <div className="text-5xl mb-4">&#x1F512;</div>
            <h2 className="font-display text-2xl font-black mb-2">Quick signup to create your page</h2>
            <p className="text-purple-300 text-sm mb-6">We need an account so you can track signups and go live when ready. Takes 30 seconds.</p>

            <div className="space-y-3">
              <Link href="/auth/signup"
                className="block w-full py-5 bg-purple-500 hover:bg-purple-400 text-white rounded-2xl font-semibold text-lg transition-colors text-center">
                Sign up free
              </Link>
              <Link href="/auth/login"
                className="block w-full py-4 bg-white/10 hover:bg-white/15 text-purple-200 rounded-2xl font-semibold text-sm transition-colors text-center">
                Already have an account? Log in
              </Link>
            </div>

            <button onClick={() => setStep('results')} className="w-full text-purple-400 mt-4 text-sm hover:text-purple-300">
              Back to results
            </button>
          </div>
        )}

        {/* ─── Step 4: Page is Live! ──────────────────────────────── */}
        {step === 'live' && (
          <div className="text-center">
            <div className="text-6xl mb-4">&#x1F389;</div>
            <h2 className="font-display text-3xl font-black mb-2">Your interest page is live!</h2>
            <p className="text-purple-300 text-sm mb-6">Share it everywhere. When enough people sign up, you go live with real orders.</p>

            {/* Link */}
            <div className="bg-white/10 border border-purple-400/30 rounded-2xl p-5 mb-4">
              <p className="text-xs text-purple-400 mb-2">Your page</p>
              <p className="font-semibold text-lg text-white break-all">{typeof window !== 'undefined' ? window.location.origin : ''}/interest/{interestSlug}</p>
            </div>

            {/* Share buttons */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/interest/${interestSlug}`); alert('Link copied!'); }}
                className="py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-semibold text-sm transition-colors">
                Copy Link
              </button>
              <button onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent(`I'm thinking of starting a ${productName} business! Would you be interested? Sign up here: ${window.location.origin}/interest/${interestSlug}`)}`, '_blank'); }}
                className="py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-semibold text-sm transition-colors">
                Share on WhatsApp
              </button>
            </div>

            {/* How it works */}
            <div className="bg-white/5 border border-purple-400/20 rounded-2xl p-5 mb-6 text-left">
              <p className="text-xs text-purple-300 uppercase tracking-wider font-semibold mb-3">What happens next</p>
              <div className="space-y-3 text-sm text-purple-200">
                <div className="flex gap-3">
                  <span className="bg-purple-500/30 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <span>Share your link on WhatsApp groups, Instagram stories, Facebook</span>
                </div>
                <div className="flex gap-3">
                  <span className="bg-purple-500/30 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <span>People sign up to be notified when you launch</span>
                </div>
                <div className="flex gap-3">
                  <span className="bg-purple-500/30 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <span>Once 10+ people sign up, we notify you — ready to take real orders!</span>
                </div>
                <div className="flex gap-3">
                  <span className="bg-green-500/30 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">&#x2713;</span>
                  <span><strong>One tap</strong> — your interest page becomes a real booking page. No re-setup needed.</span>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-white/5 border border-purple-400/20 rounded-2xl p-5 mb-6 text-center">
              <p className="font-display text-4xl font-black text-purple-300">{signupCount}</p>
              <p className="text-xs text-purple-400">people interested so far</p>
              <p className="text-xs text-purple-400/60 mt-1">{10 - signupCount > 0 ? `${10 - signupCount} more to go live` : 'Threshold reached!'}</p>
            </div>

            <div className="flex flex-col gap-3">
              <Link href="/dashboard"
                className="w-full py-4 bg-purple-500 hover:bg-purple-400 text-white rounded-2xl font-semibold text-base transition-colors text-center">
                Go to Dashboard
              </Link>
              <button onClick={() => { setStep('describe'); setIdea(''); setCity(''); }}
                className="w-full text-purple-400 text-sm hover:text-purple-300">
                Test another idea
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12">
          <div className="flex items-center justify-center gap-6 text-xs text-purple-400/40">
            <span>{currencySymbol}0 spent</span>
            <span>0 ingredients wasted</span>
            <span>10 min to validate</span>
          </div>
        </div>
      </div>
    </main>
  );
}
