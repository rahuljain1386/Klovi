'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { NICHE_TO_CATEGORIES, NICHE_OPTIONS, CATALOG_PRODUCTS, CATALOG_CATEGORIES, type CatalogProduct as StaticCatalogProduct } from '@/data/product-catalog';
import MicButton from '@/components/MicButton';

// ─── Types ──────────────────────────────────────────────────────────────────
type Step = 'about' | 'products' | 'business' | 'live';
type Niche = 'snacks' | 'bakery' | 'coaching' | 'spiritual_healing' | 'other';
type DeliveryType = 'pickup_only' | 'local_delivery' | 'nationwide';

interface CatalogProduct {
  name: string; category: string; parentCategory: string;
  title: string; description: string; highlights: string;
  variants: string[]; quantity: string;
  priceMin: number; priceMax: number; dietary: string[];
  pexelsQuery?: string; imageUrl?: string;
}

// ─── Address Autocomplete ───────────────────────────────────────────────────
function AddressInput({ value, onChange, onSelect, country }: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (place: any) => void;
  country: string;
}) {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((input: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    if (input.length < 3) { setPredictions([]); return; }
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(input)}&country=${country}`);
        if (res.ok) {
          const data = await res.json();
          setPredictions(data.predictions || []);
          setOpen(true);
        }
      } catch {}
    }, 300);
  }, [country]);

  const pick = async (p: any) => {
    onChange(p.description);
    setOpen(false);
    setPredictions([]);
    try {
      const res = await fetch(`/api/places/details?placeId=${p.placeId}`);
      if (res.ok) {
        const details = await res.json();
        onSelect(details);
      }
    } catch {}
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); search(e.target.value); }}
        onFocus={() => predictions.length > 0 && setOpen(true)}
        className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber text-ink text-base"
        placeholder="Start typing your address..."
      />
      {open && predictions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
          {predictions.map((p: any) => (
            <button
              key={p.placeId}
              onClick={() => pick(p)}
              className="w-full text-left px-4 py-3 hover:bg-cream border-b border-border last:border-0 text-sm text-ink"
            >
              <span className="font-medium">{p.mainText}</span>
              <span className="text-warm-gray text-xs block">{p.secondaryText}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('about');
  const [saving, setSaving] = useState(false);
  const [sellerId, setSellerId] = useState('');
  const [slug, setSlug] = useState('');

  // Screen 1 — About You
  const [ownerName, setOwnerName] = useState('');
  const [gender, setGender] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [niche, setNiche] = useState<Niche | ''>('');
  const [otherNiche, setOtherNiche] = useState('');

  // Screen 2 — Products (loaded from Supabase catalog_products with admin DALL-E images)
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [catalogFilter, setCatalogFilter] = useState<string | null>(null);

  // Screen 3 — Business
  const [address, setAddress] = useState('');
  const [addressDetails, setAddressDetails] = useState<any>(null);
  const [city, setCity] = useState('');
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('pickup_only');
  const [payments, setPayments] = useState<string[]>(['cash']);
  const [whatsapp, setWhatsapp] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [countryCode, setCountryCode] = useState('IN');

  // AI-generated profile (runs in background)
  const [aiProfile, setAiProfile] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // ─── Init: check auth, load existing seller ─────────────────────────────
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }

      const { data: sellers } = await supabase
        .from('sellers')
        .select('id, slug, city, business_name, owner_name, gender, niche, status, address_city, address_country_code, whatsapp_number, phone')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      let seller = sellers?.[0] || null;
      if (sellers && sellers.length > 1) {
        for (const s of sellers) {
          const { count } = await supabase
            .from('products')
            .select('id', { count: 'exact', head: true })
            .eq('seller_id', s.id);
          if ((count || 0) > 0) { seller = s; break; }
        }
      }

      if (seller) {
        setSellerId(seller.id);
        setSlug(seller.slug);
        if (seller.business_name) setBusinessName(seller.business_name);
        if (seller.owner_name) setOwnerName(seller.owner_name);
        if (seller.gender) setGender(seller.gender);
        if (seller.niche) setNiche(seller.niche as Niche);
        if (seller.city) setCity(seller.city);
        if (seller.address_city) setCity(seller.address_city);
        if (seller.address_country_code) {
          setCountryCode(seller.address_country_code);
          setCurrency(seller.address_country_code === 'IN' ? 'INR' : 'USD');
        }
        if (seller.whatsapp_number || seller.phone) {
          setWhatsapp(seller.whatsapp_number || seller.phone || '');
        }
        // Pre-fill from Google account
        if (!seller.owner_name && user.user_metadata?.full_name) {
          setOwnerName(user.user_metadata.full_name);
        }
      } else {
        // New user — pre-fill from Google
        if (user.user_metadata?.full_name) setOwnerName(user.user_metadata.full_name);
      }
    })();

    // Geo-detect country
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
          const data = await res.json();
          const c = data.address?.city || data.address?.town || data.address?.village || '';
          const s = data.address?.state || '';
          const cc = data.address?.country_code;
          if (c) setCity(prev => prev || (s ? `${c}, ${s}` : c));
          if (cc === 'in') { setCurrency('INR'); setCountryCode('IN'); }
          else if (cc === 'us') { setCurrency('USD'); setCountryCode('US'); }
        } catch {}
      }, () => {}, { timeout: 5000 }
    );
  }, [router]);

  // ─── Load catalog from Supabase DB (has admin DALL-E images) ─────────
  useEffect(() => {
    if (!niche || niche === 'other') { setCatalogProducts([]); return; }
    const categories = NICHE_TO_CATEGORIES[niche] || [];

    (async () => {
      const supabase = createClient();
      // Load from DB — catalog_products has image_url from admin DALL-E batch run
      const { data: dbProducts } = await supabase
        .from('catalog_products')
        .select('*')
        .in('parent_category', categories)
        .eq('enabled', true)
        .order('sort_order');

      if (dbProducts && dbProducts.length > 0) {
        setCatalogProducts(dbProducts.map((p: any) => ({
          name: p.name,
          category: p.category,
          parentCategory: p.parent_category,
          title: p.title,
          description: p.description,
          highlights: p.highlights,
          variants: p.variants || [],
          quantity: p.quantity || '1',
          priceMin: p.price_min,
          priceMax: p.price_max,
          dietary: p.dietary || [],
          pexelsQuery: p.pexels_query,
          imageUrl: p.image_url, // Admin-generated DALL-E image
        })));
      } else {
        // Fallback to static file if DB is empty
        const staticProducts = CATALOG_PRODUCTS.filter(p => categories.includes(p.parentCategory));
        setCatalogProducts(staticProducts);
      }

      setCatalogFilter(null);
      setSelectedProducts(new Set());
    })();
  }, [niche]);

  // ─── Generate AI profile in background ──────────────────────────────────
  const generateAiProfile = useCallback(async () => {
    if (!businessName || !niche) return;
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate-business-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          niche,
          city: addressDetails?.city || city,
          country: countryCode === 'IN' ? 'india' : 'usa',
          products: Array.from(selectedProducts),
          ownerName,
          gender,
        }),
      });
      if (res.ok) {
        const profile = await res.json();
        setAiProfile(profile);
      }
    } catch {}
    setAiLoading(false);
  }, [businessName, niche, city, countryCode, selectedProducts, ownerName, gender, addressDetails]);

  // ─── Screen 1: Save About You ───────────────────────────────────────────
  const saveAbout = async () => {
    if (!businessName.trim()) return;
    if (!niche) return;
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/auth/login'); return; }

    // Generate clean slug
    let newSlug = slug;
    if (!slug || slug.includes('-') && slug.split('-').pop()!.length > 6) {
      // Slug looks auto-generated, get a clean one
      try {
        const slugRes = await fetch('/api/onboarding/generate-slug', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessName, city }),
        });
        if (slugRes.ok) {
          const { slug: generated } = await slugRes.json();
          newSlug = generated;
        }
      } catch {}
    }
    if (!newSlug) newSlug = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const updates: Record<string, unknown> = {
      business_name: businessName.trim(),
      owner_name: ownerName.trim() || null,
      gender: gender || null,
      niche,
      slug: newSlug,
      category: niche === 'snacks' ? 'food' : niche === 'bakery' ? 'bakery' : niche === 'coaching' ? 'services' : niche === 'spiritual_healing' ? 'healing' : 'other',
    };

    if (sellerId) {
      await supabase.from('sellers').update(updates).eq('id', sellerId);
    } else {
      const { data: newSeller } = await supabase.from('sellers').insert({
        user_id: user.id,
        ...updates,
        status: 'onboarding',
        plan: 'free',
        country: countryCode === 'IN' ? 'india' : 'usa',
        language: 'en',
        city: city || '',
        phone: '',
      }).select('id').single();

      if (newSeller) setSellerId(newSeller.id);
    }

    setSlug(newSlug);
    setSaving(false);
    setStep('products');
  };

  // ─── Screen 2: Save products & start background jobs ────────────────────
  const saveProducts = async () => {
    if (selectedProducts.size === 0) return;
    if (!sellerId) {
      console.error('[Onboarding] Cannot save products — sellerId is empty');
      return;
    }
    setSaving(true);

    const supabase = createClient();
    const sym = currency === 'INR' ? '₹' : '$';

    // Insert selected catalog products (use admin DALL-E images from catalog)
    const inserts = Array.from(selectedProducts).map((name, i) => {
      const cp = catalogProducts.find(p => p.name === name);
      return {
        seller_id: sellerId,
        name,
        description: cp?.description || null,
        price: cp?.priceMin || 0,
        category: cp?.category || null,
        currency,
        sort_order: i,
        variants: cp && cp.variants.length > 0 ? JSON.stringify(cp.variants.map(v => ({ label: v, price: cp.priceMin, qty: null }))) : null,
        images: cp?.imageUrl ? [cp.imageUrl] : null, // Use admin-generated DALL-E image
        status: 'active',
        is_available: true,
      };
    });

    const { error: insertError } = await supabase.from('products').insert(inserts);
    if (insertError) {
      console.error('[Onboarding] Product insert error:', insertError.message, '| sellerId:', sellerId, '| count:', inserts.length);
    }

    setSaving(false);
    setStep('business');

    // Start AI profile generation in background
    generateAiProfile();
  };

  // ─── Screen 3: Save business details & go live ──────────────────────────
  const saveBusiness = async () => {
    if (!whatsapp.trim()) return;
    setSaving(true);

    const supabase = createClient();
    const cleanedPhone = whatsapp.trim().replace(/[\s()-]/g, '');

    const updates: Record<string, unknown> = {
      status: 'active',
      city: addressDetails?.city || city,
      address_line1: addressDetails?.addressLine1 || address,
      address_city: addressDetails?.city || city,
      address_state: addressDetails?.state || '',
      address_zip: addressDetails?.zip || '',
      address_country_code: addressDetails?.countryCode || countryCode,
      address_lat: addressDetails?.lat || null,
      address_lng: addressDetails?.lng || null,
      google_place_id: null,
      delivery_type: deliveryType,
      country: (addressDetails?.countryCode || countryCode) === 'IN' ? 'india' : 'usa',
      whatsapp_number: cleanedPhone,
      phone: cleanedPhone,
      whatsapp_path: 'own_number',
      cod_enabled: payments.includes('cash'),
      upi_id: payments.includes('upi') ? '' : null,
      fulfillment_modes: deliveryType === 'pickup_only' ? ['pickup'] : deliveryType === 'local_delivery' ? ['pickup', 'delivery'] : ['delivery'],
      pickup_address: address || null,
      onboarding_completed_at: new Date().toISOString(),
    };

    // Apply AI profile if generated
    if (aiProfile) {
      if (aiProfile.tagline) updates.tagline = aiProfile.tagline;
      if (aiProfile.tagline) updates.ai_tagline = aiProfile.tagline;
      if (aiProfile.description) updates.description = aiProfile.description;
      if (aiProfile.launchOffer) updates.launch_offer = aiProfile.launchOffer;
    }

    const { error: updateError } = await supabase.from('sellers').update(updates).eq('id', sellerId);
    if (updateError) {
      console.error('[Onboarding] Seller update error:', updateError.message);
    }

    setSaving(false);
    setStep('live');
  };

  // ─── Filtered catalog ──────────────────────────────────────────────────
  const nicheCategories = niche ? (NICHE_TO_CATEGORIES[niche] || []) : [];
  const availableCategories = CATALOG_CATEGORIES.filter(c => nicheCategories.includes(c.name));
  const filteredProducts = catalogFilter
    ? catalogProducts.filter(p => p.parentCategory === catalogFilter)
    : catalogProducts;

  const isIndia = countryCode === 'IN';
  const sym = isIndia ? '₹' : '$';

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-cream">
      <div className="max-w-[480px] mx-auto">
        {/* Header */}
        <div className="px-4 pt-6 pb-2 flex items-center justify-between">
          <span className="font-display text-2xl font-black text-ink">Klovi</span>
          <span className="text-xs text-warm-gray">
            {step === 'about' ? '1/4' : step === 'products' ? '2/4' : step === 'business' ? '3/4' : '4/4'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="px-4 mb-6">
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-amber rounded-full transition-all duration-500"
              style={{ width: step === 'about' ? '25%' : step === 'products' ? '50%' : step === 'business' ? '75%' : '100%' }}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SCREEN 1 — About You                                          */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {step === 'about' && (
          <div className="px-4 pb-32 space-y-6">
            <div>
              <h2 className="font-display text-xl font-black text-ink mb-1">Tell us about you</h2>
              <p className="text-warm-gray text-sm">We'll set up everything for you</p>
            </div>

            {/* Owner Name */}
            <div>
              <label className="text-sm font-medium text-ink block mb-1.5">Your Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="flex-1 px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber text-ink text-base"
                  placeholder="e.g., Sunita Sharma"
                />
                <MicButton onTranscript={(t) => setOwnerName(prev => prev ? `${prev} ${t}` : t)} />
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="text-sm font-medium text-ink block mb-1.5">Gender</label>
              <div className="flex gap-2">
                {[
                  { id: 'female', label: 'Female' },
                  { id: 'male', label: 'Male' },
                  { id: 'other', label: 'Other' },
                ].map(g => (
                  <button
                    key={g.id}
                    onClick={() => setGender(g.id)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                      gender === g.id
                        ? 'bg-ink text-white'
                        : 'bg-white border border-border text-warm-gray hover:border-amber'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Business Name */}
            <div>
              <label className="text-sm font-medium text-ink block mb-1.5">Business Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="flex-1 px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber text-ink text-base"
                  placeholder="e.g., Sunita's Kitchen"
                />
                <MicButton onTranscript={(t) => setBusinessName(prev => prev ? `${prev} ${t}` : t)} />
              </div>
            </div>

            {/* Niche Selection */}
            <div>
              <label className="text-sm font-medium text-ink block mb-2">What do you sell?</label>
              <div className="space-y-2">
                {NICHE_OPTIONS.map(n => (
                  <button
                    key={n.id}
                    onClick={() => setNiche(n.id as Niche)}
                    className={`w-full flex items-center gap-3 p-4 rounded-xl text-left transition-all ${
                      niche === n.id
                        ? 'bg-amber/10 border-2 border-amber'
                        : 'bg-white border border-border hover:border-amber/50'
                    }`}
                  >
                    <span className="text-2xl">{n.emoji}</span>
                    <div>
                      <span className="font-semibold text-ink text-base block">{n.label}</span>
                      <span className="text-warm-gray text-xs">{n.desc}</span>
                    </div>
                    {niche === n.id && (
                      <span className="ml-auto text-amber text-xl">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Other niche text input */}
            {niche === 'other' && (
              <div>
                <label className="text-sm font-medium text-ink block mb-1.5">Describe what you do</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={otherNiche}
                    onChange={(e) => setOtherNiche(e.target.value)}
                    className="flex-1 px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber text-ink text-base"
                    placeholder="e.g., Handmade candles, Mehendi art..."
                  />
                  <MicButton onTranscript={(t) => setOtherNiche(prev => prev ? `${prev} ${t}` : t)} />
                </div>
              </div>
            )}

            {/* Next button */}
            <button
              onClick={saveAbout}
              disabled={saving || !businessName.trim() || !niche}
              className="w-full py-4 bg-amber text-white rounded-xl font-semibold text-lg hover:bg-amber/90 disabled:opacity-40 transition-colors min-h-[56px]"
            >
              {saving ? 'Setting up...' : 'Next'}
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SCREEN 2 — Pick Your Products                                 */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {step === 'products' && (
          <div className="px-4 pb-32 space-y-4">
            <div>
              <h2 className="font-display text-xl font-black text-ink mb-1">Pick your products</h2>
              <p className="text-warm-gray text-sm">
                Tap to select — we'll set up pricing and photos for you
              </p>
            </div>

            {/* Category filter */}
            {availableCategories.length > 1 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                <button
                  onClick={() => setCatalogFilter(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    !catalogFilter ? 'bg-ink text-white' : 'bg-white border border-border text-warm-gray'
                  }`}
                >
                  All
                </button>
                {availableCategories.map(c => (
                  <button
                    key={c.name}
                    onClick={() => setCatalogFilter(c.name)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      catalogFilter === c.name ? 'bg-ink text-white' : 'bg-white border border-border text-warm-gray'
                    }`}
                  >
                    {c.emoji} {c.name}
                  </button>
                ))}
              </div>
            )}

            {/* Product grid */}
            <div className="grid grid-cols-2 gap-3">
              {filteredProducts.map(p => {
                const selected = selectedProducts.has(p.name);
                return (
                  <button
                    key={p.name}
                    onClick={() => {
                      setSelectedProducts(prev => {
                        const next = new Set(prev);
                        if (next.has(p.name)) next.delete(p.name);
                        else next.add(p.name);
                        return next;
                      });
                    }}
                    className={`relative rounded-xl overflow-hidden text-left transition-all ${
                      selected
                        ? 'ring-2 ring-amber shadow-md'
                        : 'border border-border hover:border-amber/50'
                    }`}
                  >
                    <div className="aspect-square bg-cream relative overflow-hidden">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl text-warm-gray/30">
                          {NICHE_OPTIONS.find(n => n.id === niche)?.emoji || '📦'}
                        </div>
                      )}
                      {selected && (
                        <div className="absolute top-2 right-2 w-7 h-7 bg-amber rounded-full flex items-center justify-center text-white text-sm font-bold shadow">
                          ✓
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 bg-white">
                      <p className="font-medium text-ink text-sm truncate">{p.name}</p>
                      <p className="text-warm-gray text-xs">{sym}{p.priceMin} - {sym}{p.priceMax}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {catalogProducts.length === 0 && niche === 'other' && (
              <div className="bg-white rounded-xl border border-border p-6 text-center">
                <p className="text-warm-gray text-sm mb-2">We'll create a custom catalog for you</p>
                <p className="text-ink text-sm font-medium">Just click Next — our AI will suggest products</p>
              </div>
            )}

            {/* Selected count + Next */}
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 bg-white/95 backdrop-blur-xl border-t border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <span className="text-ink font-semibold">{selectedProducts.size} selected</span>
                </div>
                <button
                  onClick={() => { setStep('about'); }}
                  className="px-4 py-3 text-warm-gray text-sm font-medium"
                >
                  Back
                </button>
                <button
                  onClick={saveProducts}
                  disabled={saving || (selectedProducts.size === 0 && niche !== 'other')}
                  className="px-8 py-3 bg-amber text-white rounded-xl font-semibold text-base hover:bg-amber/90 disabled:opacity-40 transition-colors min-h-[48px]"
                >
                  {saving ? 'Saving...' : 'Next'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SCREEN 3 — Your Business                                      */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {step === 'business' && (
          <div className="px-4 pb-32 space-y-6">
            <div>
              <h2 className="font-display text-xl font-black text-ink mb-1">Your business details</h2>
              <p className="text-warm-gray text-sm">Almost there — just a few more things</p>
            </div>

            {/* AI generating indicator */}
            {aiLoading && (
              <div className="bg-amber/10 rounded-xl p-3 flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-amber border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-ink">AI is crafting your tagline and descriptions...</span>
              </div>
            )}

            {/* Address */}
            <div>
              <label className="text-sm font-medium text-ink block mb-1.5">Your Address</label>
              <AddressInput
                value={address}
                onChange={setAddress}
                country={countryCode.toLowerCase()}
                onSelect={(details) => {
                  setAddressDetails(details);
                  if (details.city) setCity(details.city);
                  if (details.countryCode) {
                    setCountryCode(details.countryCode);
                    setCurrency(details.countryCode === 'IN' ? 'INR' : 'USD');
                  }
                }}
              />
              {!address && city && (
                <p className="text-xs text-warm-gray mt-1">Detected: {city}</p>
              )}
            </div>

            {/* Delivery */}
            <div>
              <label className="text-sm font-medium text-ink block mb-2">Do you deliver?</label>
              <div className="space-y-2">
                {[
                  { id: 'pickup_only' as DeliveryType, label: 'Pickup Only', desc: 'Customers come to you' },
                  { id: 'local_delivery' as DeliveryType, label: 'Local Delivery', desc: 'You deliver in your city' },
                  { id: 'nationwide' as DeliveryType, label: isIndia ? 'PAN India' : 'Nationwide', desc: isIndia ? 'Ship across India' : 'Ship across the USA' },
                ].map(d => (
                  <button
                    key={d.id}
                    onClick={() => setDeliveryType(d.id)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all ${
                      deliveryType === d.id
                        ? 'bg-amber/10 border-2 border-amber'
                        : 'bg-white border border-border hover:border-amber/50'
                    }`}
                  >
                    <div className="flex-1">
                      <span className="font-medium text-ink text-sm">{d.label}</span>
                      <span className="text-warm-gray text-xs block">{d.desc}</span>
                    </div>
                    {deliveryType === d.id && <span className="text-amber text-lg">✓</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Payment */}
            <div>
              <label className="text-sm font-medium text-ink block mb-2">Payment Methods</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { id: 'cash', label: 'Cash', show: true },
                  { id: 'upi', label: 'UPI', show: isIndia },
                  { id: 'stripe', label: 'Card/Stripe', show: !isIndia },
                ].filter(p => p.show).map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPayments(prev =>
                        prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]
                      );
                    }}
                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      payments.includes(p.id)
                        ? 'bg-amber/10 border-2 border-amber text-ink'
                        : 'bg-white border border-border text-warm-gray hover:border-amber/50'
                    }`}
                  >
                    {payments.includes(p.id) ? '✓ ' : ''}{p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* WhatsApp Number */}
            <div>
              <label className="text-sm font-medium text-ink block mb-1.5">Your WhatsApp Number</label>
              <p className="text-xs text-warm-gray mb-2">We'll send you order alerts here</p>
              <div className="flex gap-2">
                <input
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="flex-1 px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber text-ink text-base"
                  placeholder={isIndia ? '+91 98765 43210' : '+1 (555) 123-4567'}
                />
              </div>
              {!whatsapp.trim() && (
                <p className="text-rose text-xs mt-1">Required — so we can notify you about orders</p>
              )}
            </div>

            {/* AI tagline preview */}
            {aiProfile?.tagline && (
              <div className="bg-white rounded-xl border border-border p-4">
                <p className="text-xs text-amber font-bold tracking-wider mb-1">AI SUGGESTED TAGLINE</p>
                <p className="text-ink font-medium italic">"{aiProfile.tagline}"</p>
                {aiProfile.launchOffer && (
                  <p className="text-warm-gray text-xs mt-2">Launch offer: {aiProfile.launchOffer}</p>
                )}
              </div>
            )}

            {/* Go Live button */}
            <button
              onClick={saveBusiness}
              disabled={saving || !whatsapp.trim()}
              className="w-full py-4 bg-amber text-white rounded-xl font-semibold text-lg hover:bg-amber/90 disabled:opacity-40 transition-colors min-h-[56px]"
            >
              {saving ? 'Going live...' : 'Go Live!'}
            </button>

            <button
              onClick={() => setStep('products')}
              className="w-full py-2 text-warm-gray text-sm font-medium"
            >
              Back
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SCREEN 4 — Your Shop is Live!                                 */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {step === 'live' && (
          <div className="px-4 pb-20 space-y-6">
            {/* Celebration */}
            <div className="text-center pt-8 pb-4">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="font-display text-2xl font-black text-ink mb-2">Your shop is live!</h2>
              <p className="text-warm-gray text-sm">
                Customers can now find you and order via WhatsApp
              </p>
            </div>

            {/* Shop URL */}
            <div className="bg-white rounded-2xl border border-border p-5 text-center">
              <p className="text-xs text-warm-gray mb-2">Your shop link</p>
              <p className="font-display text-lg font-black text-amber break-all">
                kloviapp.com/{slug}
              </p>
              <div className="flex gap-2 mt-4 justify-center">
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(`https://kloviapp.com/${slug}`);
                  }}
                  className="px-5 py-2.5 bg-cream text-ink rounded-xl text-sm font-medium border border-border hover:bg-amber/10 transition-colors"
                >
                  Copy Link
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Check out my shop on Klovi! 🛍️\nhttps://kloviapp.com/${slug}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-green text-white rounded-xl text-sm font-medium hover:bg-green/90 transition-colors"
                >
                  Share on WhatsApp
                </a>
              </div>
            </div>

            {/* AI Profile summary */}
            {aiProfile && (
              <div className="bg-white rounded-2xl border border-border p-5">
                <p className="text-xs text-amber font-bold tracking-wider mb-2">AI CREATED FOR YOU</p>
                {aiProfile.tagline && (
                  <p className="text-ink font-medium mb-1">"{aiProfile.tagline}"</p>
                )}
                {aiProfile.description && (
                  <p className="text-warm-gray text-sm mb-2">{aiProfile.description}</p>
                )}
                {aiProfile.topSellingTip && (
                  <p className="text-warm-gray text-xs italic border-t border-border pt-2 mt-2">
                    💡 {aiProfile.topSellingTip}
                  </p>
                )}
              </div>
            )}

            {/* What happens next */}
            <div className="bg-white rounded-2xl border border-border p-5">
              <p className="text-xs text-amber font-bold tracking-wider mb-3">WHAT HAPPENS NOW</p>
              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <span className="text-lg">💬</span>
                  <div>
                    <p className="text-sm font-medium text-ink">Customers message your shop</p>
                    <p className="text-xs text-warm-gray">AI replies instantly, takes orders, handles everything</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-lg">🔔</span>
                  <div>
                    <p className="text-sm font-medium text-ink">You get order alerts on WhatsApp</p>
                    <p className="text-xs text-warm-gray">Confirm with one tap, prepare & hand over</p>
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="text-lg">📊</span>
                  <div>
                    <p className="text-sm font-medium text-ink">Daily summary at end of day</p>
                    <p className="text-xs text-warm-gray">Orders, revenue, what to prep tomorrow</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <a
                href={`/${slug}`}
                className="w-full py-4 bg-ink text-white rounded-xl font-semibold text-base flex items-center justify-center gap-2 hover:bg-ink/90 transition-colors min-h-[56px]"
              >
                View Your Shop
              </a>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-3 text-warm-gray text-sm font-medium hover:text-ink transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
