'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

type Step = 'login-gate' | 'describe' | 'analyzing' | 'results' | 'live';

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
        fd.append('language', 'auto');
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

type MenuItem = { name: string; price: number; why: string };

export default function TestIdeaPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('login-gate');
  const [idea, setIdea] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('india');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');

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
  const [suggestedMenu, setSuggestedMenu] = useState<MenuItem[]>([]);
  const [howToStart, setHowToStart] = useState<string[]>([]);
  const [whereToSell, setWhereToSell] = useState<string[]>([]);
  const [bestTimes, setBestTimes] = useState('');
  const [startupCost, setStartupCost] = useState('');
  const [monthlyPotential, setMonthlyPotential] = useState('');
  const [tips, setTips] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'menu' | 'howto' | 'tips'>('overview');

  // Interest page
  const [interestSlug, setInterestSlug] = useState('');
  const [signupCount, setSignupCount] = useState(0);

  const currencySymbol = country === 'india' ? '\u20B9' : '$';

  // Check login status on mount
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsLoggedIn(true);
        setUserName(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '');
        setStep('describe');

        // Auto-detect country from existing seller profile
        const { data: seller } = await supabase.from('sellers').select('country, city').eq('user_id', user.id).single();
        if (seller?.country) setCountry(seller.country);
        if (seller?.city) setAddress(seller.city);
      }

      // Resume flow after signup
      const saved = localStorage.getItem('klovi_test_idea_input');
      if (saved && user) {
        try {
          const data = JSON.parse(saved);
          setIdea(data.idea || '');
          setAddress(data.address || '');
          setCountry(data.country || 'india');
          localStorage.removeItem('klovi_test_idea_input');
        } catch {
          localStorage.removeItem('klovi_test_idea_input');
        }
      }
    })();
  }, []);

  // Detect location
  const detectLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json&addressdetails=1`, {
          headers: { 'Accept-Language': 'en' },
        });
        const data = await res.json();
        if (data.display_name) {
          // Get a readable address: suburb, city, state
          const parts = [];
          if (data.address?.suburb || data.address?.neighbourhood) parts.push(data.address.suburb || data.address.neighbourhood);
          if (data.address?.city || data.address?.town) parts.push(data.address.city || data.address.town);
          if (data.address?.state) parts.push(data.address.state);
          setAddress(parts.join(', ') || data.display_name.split(',').slice(0, 3).join(','));

          // Auto-detect country
          const cc = data.address?.country_code;
          if (cc === 'in') setCountry('india');
          else setCountry('usa');
        }
      } catch { /* */ }
    }, () => { /* denied */ });
  };

  const goToSignup = () => {
    // Save input so we can restore after signup
    if (idea.trim() || address.trim()) {
      localStorage.setItem('klovi_test_idea_input', JSON.stringify({ idea, address, country }));
    }
    router.push('/auth/signup?next=/test-idea');
  };

  const checkDemand = async () => {
    if (!idea.trim() || !address.trim()) {
      setError('Tell us what you want to sell and your location');
      return;
    }
    setError('');
    setStep('analyzing');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/demand-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: idea, city: address, country }),
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
      setSuggestedMenu(data.suggested_menu || []);
      setHowToStart(data.how_to_start || []);
      setWhereToSell(data.where_to_sell || []);
      setBestTimes(data.best_times || '');
      setStartupCost(data.startup_cost || '');
      setMonthlyPotential(data.monthly_potential || '');
      setTips(data.tips || []);
      setStep('results');
    } catch {
      setError('Something went wrong. Please try again.');
      setStep('describe');
    }
    setLoading(false);
  };

  const createInterestPage = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      goToSignup();
      return;
    }

    setLoading(true);

    // Get or create seller record
    let { data: seller } = await supabase.from('sellers').select('id').eq('user_id', user.id).single();

    if (!seller) {
      const slug = productName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim() || 'my-business';

      const { data: newSeller } = await supabase.from('sellers').insert({
        user_id: user.id,
        business_name: productName,
        slug,
        status: 'aspiring',
        plan: 'free',
        country,
        language: country === 'india' ? 'hi' : 'en',
        city: address,
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

    const { data: existing } = await supabase.from('interest_pages').select('id').eq('slug', pageSlug).single();
    const finalSlug = existing ? `${pageSlug}-${Math.random().toString(36).slice(2, 6)}` : pageSlug;

    const { data: page, error: pageError } = await supabase.from('interest_pages').insert({
      seller_id: seller.id,
      slug: finalSlug,
      product_name: productName,
      product_description: idea,
      city: address,
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
          {isLoggedIn ? (
            <Link href="/dashboard" className="text-xs text-purple-400 hover:text-purple-300">Dashboard</Link>
          ) : (
            <Link href="/auth/login" className="text-xs text-purple-400 hover:text-purple-300">Already selling? Log in</Link>
          )}
        </div>

        {/* ─── Login Gate ──────────────────────────────────────────── */}
        {step === 'login-gate' && (
          <div>
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">💡</div>
              <h1 className="font-display text-3xl font-black mb-3">Test your business idea</h1>
              <p className="text-purple-300 text-sm leading-relaxed">
                Get a complete startup guide — what to sell, pricing, where to find customers near you, and how to start. All free.
              </p>
            </div>

            <div className="bg-white/5 border border-purple-400/20 rounded-2xl p-5 mb-6">
              <p className="text-xs text-purple-300 uppercase tracking-wider font-semibold mb-3">What you get</p>
              <div className="space-y-3 text-sm text-purple-200">
                <div className="flex gap-3 items-start">
                  <span className="text-lg">📊</span>
                  <span>Demand analysis for your exact location</span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-lg">📋</span>
                  <span>Suggested menu with pricing that works</span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-lg">📍</span>
                  <span>Where to sell near your home</span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-lg">🚀</span>
                  <span>Step-by-step guide to launch</span>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-lg">💰</span>
                  <span>Revenue potential & startup cost</span>
                </div>
              </div>
            </div>

            <button onClick={goToSignup}
              className="w-full py-5 bg-purple-500 hover:bg-purple-400 text-white rounded-2xl font-semibold text-lg transition-colors min-h-[60px] mb-3">
              Sign up free to get your guide
            </button>
            <Link href="/auth/login"
              className="block w-full py-4 bg-white/10 hover:bg-white/15 text-purple-200 rounded-2xl font-semibold text-sm transition-colors text-center mb-3">
              Already have an account? Log in
            </Link>
            <p className="text-center text-purple-400/60 text-xs">Free forever. No credit card needed.</p>
          </div>
        )}

        {/* ─── Step 1: Describe Your Idea ──────────────────────────── */}
        {step === 'describe' && (
          <div>
            <div className="text-center mb-8">
              <div className="text-5xl mb-4">💭</div>
              <h1 className="font-display text-3xl font-black mb-2">
                {userName ? `${userName}, what's your idea?` : 'Test your idea'}
              </h1>
              <p className="text-purple-300 text-sm">Type in any language — Hindi, English, or mix. We'll understand.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2 block">What do you want to sell?</label>
                <div className="flex gap-3">
                  <input type="text" value={idea} onChange={(e) => setIdea(e.target.value)}
                    className="flex-1 bg-white/10 border border-purple-400/30 rounded-xl px-4 py-4 text-base placeholder-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                    placeholder='e.g., "ghar ka khana", "homemade cakes", "tuition classes"' autoFocus />
                  <MicButton onTranscript={(text) => setIdea(prev => prev ? `${prev}, ${text}` : text)} />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2 block">Your home location</label>
                <div className="flex gap-3">
                  <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
                    className="flex-1 bg-white/10 border border-purple-400/30 rounded-xl px-4 py-4 text-base placeholder-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                    placeholder="e.g., Malviya Nagar, Jaipur or 5th Ave, Brooklyn" />
                  <button onClick={detectLocation} type="button"
                    className="w-14 h-14 rounded-full bg-white/10 text-purple-300 hover:bg-white/20 flex items-center justify-center flex-shrink-0 transition-colors" title="Use my location">
                    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-purple-400/60 mt-1">The more specific, the better your guide will be</p>
              </div>

              <div className="flex gap-2">
                {[
                  { code: 'india', flag: '\uD83C\uDDEE\uD83C\uDDF3', label: 'India' },
                  { code: 'usa', flag: '\uD83C\uDDFA\uD83C\uDDF8', label: 'USA' },
                ].map(c => (
                  <button key={c.code} onClick={() => setCountry(c.code)}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${country === c.code ? 'bg-purple-500/40 border border-purple-400/60 text-white' : 'bg-white/5 border border-white/10 text-purple-400'}`}>
                    {c.flag} {c.label}
                  </button>
                ))}
              </div>

              {error && <p className="text-rose-400 text-sm text-center">{error}</p>}

              <button onClick={checkDemand} disabled={loading || !idea.trim() || !address.trim()}
                className="w-full py-5 bg-purple-500 hover:bg-purple-400 text-white rounded-2xl font-semibold text-lg transition-colors disabled:opacity-40 min-h-[60px]">
                Get My Startup Guide
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 2: Analyzing ──────────────────────────────────── */}
        {step === 'analyzing' && (
          <div className="text-center py-16">
            <div className="inline-block w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mb-6" />
            <h2 className="font-display text-2xl font-black mb-2">Building your startup guide...</h2>
            <p className="text-purple-300 text-sm">Analyzing demand, competition, pricing & opportunities near {address}</p>
          </div>
        )}

        {/* ─── Step 3: Results — Tabbed Startup Guide ──────────────── */}
        {step === 'results' && (
          <div>
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">{demandLevel === 'HIGH' ? '\uD83D\uDD25' : demandLevel === 'MEDIUM' ? '\uD83D\uDCA1' : '\uD83E\uDD14'}</div>
              <h2 className="font-display text-xl font-black mb-1">Your Startup Guide</h2>
              <p className="text-purple-300 text-sm">{productName} near {address}</p>
            </div>

            {/* Demand badge */}
            <div className={`${demandBg} border rounded-2xl p-4 mb-4 flex items-center justify-between`}>
              <div>
                <p className="text-xs text-purple-300 uppercase tracking-wider font-semibold">Demand</p>
                <p className={`font-display text-2xl font-black ${demandColor}`}>{demandLevel}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-purple-300">Startup cost</p>
                <p className="font-semibold text-white text-sm">{startupCost || 'N/A'}</p>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-white/5 border border-purple-400/20 rounded-2xl p-4 mb-4">
              <p className="text-sm text-purple-100 leading-relaxed">{demandSummary}</p>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-4">
              {[
                { key: 'overview' as const, label: 'Overview' },
                { key: 'menu' as const, label: 'Menu' },
                { key: 'howto' as const, label: 'How To' },
                { key: 'tips' as const, label: 'Tips' },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === tab.key ? 'bg-purple-500 text-white' : 'text-purple-400 hover:text-white'}`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab: Overview */}
            {activeTab === 'overview' && (
              <div className="space-y-3">
                {/* Pricing */}
                <div className="bg-white/5 border border-purple-400/20 rounded-2xl p-4">
                  <p className="text-xs text-purple-300 uppercase tracking-wider font-semibold mb-3">Pricing</p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-purple-300">Competitors:</span>
                    <span className="font-semibold text-white">{currencySymbol}{competitorLow} — {currencySymbol}{competitorHigh}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-purple-300">Your sweet spot:</span>
                    <span className="font-display text-2xl font-black text-purple-300">{currencySymbol}{suggestedPrice}</span>
                  </div>
                </div>

                {/* Revenue potential */}
                <div className="bg-purple-500/20 border border-purple-400/30 rounded-2xl p-4 text-center">
                  <p className="text-xs text-purple-300 uppercase tracking-wider font-semibold mb-1">Monthly potential</p>
                  <p className="font-display text-2xl font-black text-purple-300">{monthlyPotential || `${currencySymbol}${suggestedPrice * 100}`}</p>
                  {bestTimes && <p className="text-xs text-purple-400 mt-1">Peak demand: {bestTimes}</p>}
                </div>

                {/* Where to sell */}
                {whereToSell.length > 0 && (
                  <div className="bg-white/5 border border-purple-400/20 rounded-2xl p-4">
                    <p className="text-xs text-purple-300 uppercase tracking-wider font-semibold mb-3">Where to find customers near you</p>
                    <div className="space-y-2">
                      {whereToSell.map((place, i) => (
                        <div key={i} className="flex gap-2 items-start text-sm text-purple-200">
                          <span className="text-purple-400 mt-0.5">📍</span>
                          <span>{place}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Competitor insight */}
                <div className="bg-white/5 border border-purple-400/20 rounded-2xl p-4">
                  <p className="text-xs text-purple-300 uppercase tracking-wider font-semibold mb-2">Competition</p>
                  <p className="text-sm text-purple-100 leading-relaxed">{competitorAnalysis}</p>
                </div>

                {/* AI insight */}
                <div className="bg-white/5 border border-purple-400/20 rounded-2xl p-4">
                  <p className="text-xs text-purple-300 uppercase tracking-wider font-semibold mb-2">Key Insight</p>
                  <p className="text-sm text-purple-100 leading-relaxed">{insight}</p>
                </div>
              </div>
            )}

            {/* Tab: Suggested Menu */}
            {activeTab === 'menu' && (
              <div className="space-y-3">
                <p className="text-xs text-purple-400">Items that sell well in your area</p>
                {suggestedMenu.length > 0 ? (
                  suggestedMenu.map((item, i) => (
                    <div key={i} className="bg-white/5 border border-purple-400/20 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-white text-sm">{item.name}</span>
                        <span className="font-display font-bold text-purple-300">{currencySymbol}{item.price}</span>
                      </div>
                      <p className="text-xs text-purple-400">{item.why}</p>
                    </div>
                  ))
                ) : (
                  <div className="bg-white/5 border border-purple-400/20 rounded-2xl p-6 text-center">
                    <p className="text-purple-400 text-sm">No menu suggestions available</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab: How To Start */}
            {activeTab === 'howto' && (
              <div className="space-y-3">
                <p className="text-xs text-purple-400 mb-2">Your step-by-step launch plan</p>
                {howToStart.length > 0 ? (
                  howToStart.map((stepText, i) => (
                    <div key={i} className="bg-white/5 border border-purple-400/20 rounded-2xl p-4 flex gap-3 items-start">
                      <span className="bg-purple-500/30 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                      <p className="text-sm text-purple-100 leading-relaxed">{stepText.replace(/^Step \d+:\s*/i, '')}</p>
                    </div>
                  ))
                ) : (
                  <div className="bg-white/5 border border-purple-400/20 rounded-2xl p-6 text-center">
                    <p className="text-purple-400 text-sm">No steps available</p>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Tips */}
            {activeTab === 'tips' && (
              <div className="space-y-3">
                <p className="text-xs text-purple-400 mb-2">Pro tips for your area</p>
                {tips.length > 0 ? (
                  tips.map((tip, i) => (
                    <div key={i} className="bg-white/5 border border-purple-400/20 rounded-2xl p-4 flex gap-3 items-start">
                      <span className="text-lg">💡</span>
                      <p className="text-sm text-purple-100 leading-relaxed">{tip}</p>
                    </div>
                  ))
                ) : (
                  <div className="bg-white/5 border border-purple-400/20 rounded-2xl p-6 text-center">
                    <p className="text-purple-400 text-sm">No tips available</p>
                  </div>
                )}

                {/* Pivot suggestions */}
                {pivotSuggestions.length > 0 && (
                  <div className="bg-white/5 border border-purple-400/20 rounded-2xl p-4 mt-4">
                    <p className="text-xs text-purple-300 uppercase tracking-wider font-semibold mb-3">
                      Other ideas to explore
                    </p>
                    <div className="space-y-2">
                      {pivotSuggestions.map((s, i) => (
                        <button key={i} onClick={() => tryPivot(s)}
                          className="w-full text-left bg-white/5 hover:bg-white/10 border border-purple-400/20 rounded-xl px-4 py-3 text-sm text-purple-200 transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom CTAs */}
            <div className="mt-6 space-y-3">
              <button onClick={createInterestPage} disabled={loading}
                className="w-full py-5 bg-purple-500 hover:bg-purple-400 text-white rounded-2xl font-semibold text-lg transition-colors disabled:opacity-50 min-h-[60px]">
                {loading ? 'Creating...' : 'Create my interest page — free'}
              </button>
              <Link href="/onboarding"
                className="block w-full py-4 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-semibold text-base transition-colors text-center">
                Ready to start? Launch my shop now
              </Link>
              <button onClick={() => setStep('describe')} className="w-full text-purple-400 text-sm hover:text-purple-300">
                Try a different idea
              </button>
            </div>

            {error && <p className="text-rose-400 text-sm text-center mt-3">{error}</p>}
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
              <button onClick={() => { setStep('describe'); setIdea(''); setAddress(''); }}
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
            <span>0 risk</span>
            <span>5 min to validate</span>
          </div>
        </div>
      </div>
    </main>
  );
}
