'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { NICHE_TO_CATEGORIES, NICHE_OPTIONS, CATALOG_PRODUCTS, CATALOG_CATEGORIES, type CatalogProduct as StaticCatalogProduct } from '@/data/product-catalog';
import MicButton from '@/components/MicButton';

// Track whether user has manually edited a field (to prevent DB overwrite)
const useEditTracker = () => {
  const edited = useRef<Set<string>>(new Set());
  return {
    markEdited: (field: string) => edited.current.add(field),
    wasEdited: (field: string) => edited.current.has(field),
  };
};

// ─── Types ──────────────────────────────────────────────────────────────────
type Step = 'about' | 'products' | 'business' | 'live';
type Niche = 'snacks' | 'bakery' | 'coaching' | 'spiritual_healing' | 'other';
type DeliveryMode = 'pickup' | 'delivery' | 'shipping';

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
  const [error, setError] = useState('');
  const [sellerId, _setSellerId] = useState('');
  const sellerIdRef = useRef('');
  const setSellerId = (id: string) => { sellerIdRef.current = id; _setSellerId(id); };
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

  // Product edits — overrides keyed by product name (catalog) or custom ID
  interface VariantEdit { label: string; price: number }
  interface ProductEdit {
    name: string; description: string; price: number; image: string | null;
    category: string; quantity: string; isCustom?: boolean; variants: VariantEdit[];
  }
  const [productEdits, setProductEdits] = useState<Record<string, ProductEdit>>({});

  // Screen 3 — Business
  const [address, setAddress] = useState('');
  const [addressDetails, setAddressDetails] = useState<any>(null);
  const [city, setCity] = useState('');
  const [deliveryModes, setDeliveryModes] = useState<Set<DeliveryMode>>(new Set(['pickup']));
  const [payments, setPayments] = useState<string[]>(['cash']);
  const [whatsapp, setWhatsapp] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [countryCode, setCountryCode] = useState('IN');

  // Knowledge base (editable FAQ generated during onboarding)
  interface KBEntry { id?: string; question: string; answer: string }
  const [knowledgeEntries, setKnowledgeEntries] = useState<KBEntry[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbExpanded, setKbExpanded] = useState(false);

  // AI-generated profile (runs in background)
  const [aiProfile, setAiProfile] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { markEdited, wasEdited } = useEditTracker();

  // ─── Init: check auth, load existing seller ─────────────────────────────
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr) { setError(`Init auth error: ${authErr.message}`); }
      if (!user) { router.push('/auth/login'); return; }

      const { data: sellers } = await supabase
        .from('sellers')
        .select('id, slug, city, business_name, owner_name, gender, niche, status, address_city, address_country_code, whatsapp_number, phone')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Prefer a seller still in 'onboarding' (incomplete signup).
      // If all sellers are active/live, don't reuse — let saveAbout create a fresh one.
      let seller = sellers?.[0] || null;
      seller = null; // Reset — only use if we find one in 'onboarding'
      if (sellers && sellers.length > 0) {
        seller = sellers.find(s => s.status === 'onboarding') || null;
      }

      if (seller) {
        setSellerId(seller.id);
        setSlug(seller.slug);

        // Pre-fill from the incomplete onboarding seller
        if (seller.business_name) setBusinessName(seller.business_name);
        if (seller.owner_name) setOwnerName(seller.owner_name);
        if (seller.gender) setGender(seller.gender);
        if (seller.niche) setNiche(seller.niche as Niche);
        if (seller.whatsapp_number || seller.phone) {
          setWhatsapp(seller.whatsapp_number || seller.phone || '');
        }
      }

      // Country/currency from any existing seller or geo-detect
      const anySeller = seller || sellers?.[0];
      if (anySeller) {
        if (anySeller.city) setCity(anySeller.city);
        if (anySeller.address_city) setCity(anySeller.address_city);
        if (anySeller.address_country_code) {
          setCountryCode(anySeller.address_country_code);
          setCurrency(anySeller.address_country_code === 'IN' ? 'INR' : 'USD');
        }
      }

      // Also check localStorage (set during Google signup flow)
      const pendingBiz = typeof window !== 'undefined' ? localStorage.getItem('klovi_pending_business') : null;
      if (pendingBiz && !businessName) {
        setBusinessName(pendingBiz);
        localStorage.removeItem('klovi_pending_business');
      }

      // Pre-fill owner name from Google OAuth only (real name, not email username)
      const isGoogle = user.app_metadata?.provider === 'google';
      if (isGoogle && user.user_metadata?.full_name && !wasEdited('ownerName')) {
        setOwnerName(prev => prev || user.user_metadata.full_name);
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
    // Clear immediately — don't wait for async
    setSelectedProducts(new Set());
    setProductEdits({});
    setCatalogFilter(null);
    setCatalogProducts([]);

    if (!niche || niche === 'other') return;
    const categories = NICHE_TO_CATEGORIES[niche] || [];

    (async () => {
      const supabase = createClient();
      const { data: dbProducts, error: catalogErr } = await supabase
        .from('catalog_products')
        .select('*')
        .in('parent_category', categories)
        .eq('enabled', true)
        .order('sort_order');

      if (catalogErr) {
        setError(`Catalog load error: ${catalogErr.message}`);
      }

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
          imageUrl: p.image_url,
        })));
      } else {
        const staticProducts = CATALOG_PRODUCTS.filter(p => categories.includes(p.parentCategory));
        setCatalogProducts(staticProducts);
      }
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

  // ─── Screen 1: Save About You (via server API to bypass RLS) ────────────
  const saveAbout = async () => {
    if (!businessName.trim()) return;
    if (!niche) return;
    setError('');
    setSaving(true);

    try {
      // Always generate a fresh slug from the current business name
      let newSlug = '';
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
      if (!newSlug) newSlug = businessName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      const updates: Record<string, unknown> = {
        business_name: businessName.trim(),
        owner_name: ownerName.trim() || null,
        gender: gender || null,
        niche,
        slug: newSlug,
        category: niche === 'snacks' ? 'food' : niche === 'bakery' ? 'bakery' : niche === 'coaching' ? 'services' : niche === 'spiritual_healing' ? 'healing' : 'other',
      };

      // New seller — add required fields
      if (!sellerId) {
        Object.assign(updates, {
          status: 'onboarding',
          plan: 'free',
          country: countryCode === 'IN' ? 'india' : 'usa',
          language: 'en',
          city: city || '',
          phone: '',
        });
      }

      const res = await fetch('/api/onboarding/save-seller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId: sellerId || null, updates }),
      });
      const result = await res.json();

      if (!res.ok) {
        setError(`Save seller failed (${res.status}): ${result.error}`);
        setSaving(false);
        return;
      }

      // Update local state with server response
      // Always set sellerId from response — ensures we have the correct ID
      if (result.seller?.id) setSellerId(result.seller.id);
      if (result.seller?.slug) newSlug = result.seller.slug;

      setSlug(newSlug);
      setSaving(false);
      setStep('products');
    } catch (e: any) {
      setError(`Unexpected error: ${e.message}`);
      setSaving(false);
    }
  };

  // ─── Screen 2: Save products via server API (bypasses RLS) ──────────────
  const saveProducts = async () => {
    if (selectedProducts.size === 0) return;
    setError('');

    // Use ref as fallback — setState may not have flushed yet after saveAbout
    const effectiveSellerId = sellerId || sellerIdRef.current;
    if (!effectiveSellerId) {
      setError('ERROR: sellerId is empty — go back to step 1 and try again');
      return;
    }
    setSaving(true);

    // Build product data — apply user edits over catalog defaults
    const products = Array.from(selectedProducts).map((name) => {
      const cp = catalogProducts.find(p => p.name === name);
      const edit = productEdits[name];
      // Variants: only save user-added sizes (not catalog flavor types)
      let variantsJson: string | null = null;
      if (edit?.variants && edit.variants.length > 0) {
        const validVariants = edit.variants.filter(v => v.label.trim());
        if (validVariants.length > 0) {
          variantsJson = JSON.stringify(validVariants.map(v => ({ label: v.label, price: v.price, qty: null })));
        }
      }
      return {
        name: edit?.name || name,
        description: edit?.description ?? cp?.description ?? null,
        price: edit?.price ?? cp?.priceMin ?? 0,
        category: edit?.category ?? cp?.category ?? null,
        quantity: edit?.quantity ?? cp?.quantity ?? null,
        currency,
        variants: variantsJson,
        images: (edit?.image ? [edit.image] : cp?.imageUrl ? [cp.imageUrl] : null),
      };
    });

    try {
      const res = await fetch('/api/onboarding/save-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId: effectiveSellerId, products }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(`Product save failed (${res.status}): ${result.error || JSON.stringify(result)}`);
        setSaving(false);
        return;
      }
      if (!result.count || result.count === 0) {
        setError(`Products API returned 0 saved. Response: ${JSON.stringify(result)}`);
        setSaving(false);
        return;
      }
      // Success — show count briefly
      setError('');
    } catch (err: any) {
      setError(`Product save request failed: ${err.message}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    setStep('business');

    // Start AI profile + knowledge base generation in background
    generateAiProfile();
    // Generate FAQ/knowledge base for WhatsApp bot
    setKbLoading(true);
    fetch('/api/onboarding/generate-knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sellerId: effectiveSellerId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.entries && Array.isArray(data.entries)) {
          setKnowledgeEntries(data.entries);
        }
      })
      .catch(() => {})
      .finally(() => setKbLoading(false));
  };

  // ─── Screen 3: Save business details & go live (via server API) ─────────
  const saveBusiness = async () => {
    if (!whatsapp.trim()) return;
    setError('');
    setSaving(true);

    // Save edited knowledge base entries (if any)
    const effectiveId = sellerId || sellerIdRef.current;
    if (knowledgeEntries.length > 0 && effectiveId) {
      try {
        await fetch('/api/onboarding/save-knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sellerId: effectiveId, entries: knowledgeEntries }),
        });
      } catch {} // non-blocking — don't fail go-live for this
    }

    try {
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
        delivery_type: Array.from(deliveryModes).join(','),
        country: (addressDetails?.countryCode || countryCode) === 'IN' ? 'india' : 'usa',
        whatsapp_number: cleanedPhone,
        phone: cleanedPhone,
        whatsapp_path: 'own_number',
        cod_enabled: payments.includes('cash'),
        upi_id: payments.includes('upi') ? '' : null,
        fulfillment_modes: Array.from(deliveryModes),
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

      const effectiveId = sellerId || sellerIdRef.current;
      const res = await fetch('/api/onboarding/save-seller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerId: effectiveId, updates }),
      });
      const result = await res.json();

      if (!res.ok) {
        setError(`Go Live failed (${res.status}): ${result.error}`);
        setSaving(false);
        return;
      }

      setSaving(false);
      setStep('live');
    } catch (e: any) {
      setError(`Go Live unexpected error: ${e.message}`);
      setSaving(false);
    }
  };

  // ─── Filtered catalog ──────────────────────────────────────────────────
  const nicheCategories = niche ? (NICHE_TO_CATEGORIES[niche] || []) : [];
  const availableCategories = CATALOG_CATEGORIES.filter(c => nicheCategories.includes(c.name));
  const filteredProducts = catalogFilter
    ? catalogProducts.filter(p => p.parentCategory === catalogFilter)
    : catalogProducts;

  const isIndia = countryCode === 'IN';
  const sym = isIndia ? '₹' : '$';

  // ─── Product edit helpers (used in products step) ─────────────────────
  const getEdit = (key: string): ProductEdit => {
    if (productEdits[key]) return productEdits[key];
    const cp = catalogProducts.find(p => p.name === key);
    return {
      name: cp?.name || key, description: cp?.description || '',
      price: cp?.priceMin || 0, image: cp?.imageUrl || null,
      category: cp?.category || '', quantity: cp?.quantity || '', variants: [],
    };
  };
  const updateEdit = (key: string, patch: Partial<ProductEdit>) => {
    setProductEdits(prev => ({ ...prev, [key]: { ...getEdit(key), ...patch } }));
  };
  const handleProductImageUpload = (key: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => updateEdit(key, { image: reader.result as string });
    reader.readAsDataURL(file);
  };
  const selectedKeys = Array.from(selectedProducts);

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

        {/* Error banner — visible on screen for debugging */}
        {error && (
          <div className="mx-4 mb-4 bg-red-50 border border-red-300 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <span className="text-red-500 text-lg flex-shrink-0">!</span>
              <div className="flex-1 min-w-0">
                <p className="text-red-700 text-sm font-medium break-words">{error}</p>
                <p className="text-red-400 text-xs mt-1">sellerId: {sellerId || 'EMPTY'} | step: {step} | slug: {slug || 'EMPTY'}</p>
              </div>
              <button onClick={() => setError('')} className="text-red-400 text-xs flex-shrink-0">dismiss</button>
            </div>
          </div>
        )}

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
                  onChange={(e) => { markEdited('ownerName'); setOwnerName(e.target.value); }}
                  className="flex-1 px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber text-ink text-base"
                  placeholder="e.g., Sunita Sharma"
                />
                <MicButton onTranscript={(t) => { markEdited('ownerName'); setOwnerName(prev => prev ? `${prev} ${t}` : t); }} />
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
                    onClick={() => { markEdited('gender'); setGender(g.id); }}
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
                  onChange={(e) => { markEdited('businessName'); setBusinessName(e.target.value); }}
                  className="flex-1 px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber text-ink text-base"
                  placeholder="e.g., Sunita's Kitchen"
                />
                <MicButton onTranscript={(t) => { markEdited('businessName'); setBusinessName(prev => prev ? `${prev} ${t}` : t); }} />
              </div>
            </div>

            {/* Niche Selection */}
            <div>
              <label className="text-sm font-medium text-ink block mb-2">What do you sell?</label>
              <div className="space-y-2">
                {NICHE_OPTIONS.map(n => (
                  <button
                    key={n.id}
                    onClick={() => { markEdited('niche'); setNiche(n.id as Niche); }}
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
              <p className="text-warm-gray text-sm">Tap to add from catalog, then edit everything below</p>
            </div>

            {/* ── Catalog Picker (compact horizontal scroll) ── */}
            {catalogProducts.length > 0 && (
              <div>
                {/* Category filter */}
                {availableCategories.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                    <button onClick={() => setCatalogFilter(null)}
                      className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${!catalogFilter ? 'bg-ink text-white' : 'bg-white border border-border text-warm-gray'}`}>
                      All
                    </button>
                    {availableCategories.map(c => (
                      <button key={c.name} onClick={() => setCatalogFilter(c.name)}
                        className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${catalogFilter === c.name ? 'bg-ink text-white' : 'bg-white border border-border text-warm-gray'}`}>
                        {c.emoji} {c.name}
                      </button>
                    ))}
                  </div>
                )}
                {/* Horizontal scrollable catalog */}
                <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
                  {filteredProducts.map(p => {
                    const selected = selectedProducts.has(p.name);
                    return (
                      <button key={p.name} onClick={() => {
                        setSelectedProducts(prev => {
                          const next = new Set(prev);
                          if (next.has(p.name)) { next.delete(p.name); } else { next.add(p.name); }
                          return next;
                        });
                      }}
                        className={`flex-shrink-0 w-28 rounded-xl overflow-hidden text-left transition-all ${selected ? 'ring-2 ring-amber shadow-md' : 'border border-border'}`}>
                        <div className="w-28 h-28 bg-cream relative overflow-hidden">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl text-warm-gray/30">{NICHE_OPTIONS.find(n => n.id === niche)?.emoji || '📦'}</div>
                          )}
                          {selected && <div className="absolute top-1.5 right-1.5 w-6 h-6 bg-amber rounded-full flex items-center justify-center text-white text-xs font-bold shadow">✓</div>}
                        </div>
                        <div className="p-1.5 bg-white">
                          <p className="font-medium text-ink text-[11px] leading-tight truncate">{p.name}</p>
                          <p className="text-warm-gray text-[10px]">{sym}{p.priceMin}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {catalogProducts.length === 0 && niche === 'other' && (
              <div className="bg-white rounded-xl border border-border p-4 text-center">
                <p className="text-warm-gray text-sm">No catalog for this category — add your own below</p>
              </div>
            )}

            {/* ── Your Products — Editable Grid ── */}
            {selectedKeys.length > 0 && (
              <div>
                <h3 className="font-semibold text-ink text-sm mb-2">Your Products ({selectedKeys.length})</h3>
                <div className="space-y-3">
                  {selectedKeys.map(key => {
                    const edit = getEdit(key);
                    const cp = catalogProducts.find(p => p.name === key);
                    const imgSrc = edit.image || cp?.imageUrl || null;
                    return (
                      <div key={key} className="bg-white rounded-xl border border-border overflow-hidden">
                        <div className="flex gap-3 p-3">
                          {/* Image thumbnail + change */}
                          <div className="flex-shrink-0">
                            <label className="block w-20 h-20 rounded-lg overflow-hidden bg-cream border border-border cursor-pointer relative group">
                              {imgSrc ? (
                                <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-2xl text-warm-gray/30">📷</div>
                              )}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                <span className="text-white text-[10px] font-medium opacity-0 group-hover:opacity-100">Change</span>
                              </div>
                              <input type="file" accept="image/*" onChange={e => handleProductImageUpload(key, e)} className="hidden" />
                            </label>
                          </div>

                          {/* Name + Description + Price inline */}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <input type="text" value={edit.name}
                              onChange={e => updateEdit(key, { name: e.target.value })}
                              className="w-full px-2 py-1 text-sm font-semibold text-ink border border-transparent hover:border-border focus:border-amber rounded-lg focus:outline-none"
                              placeholder="Product name" />
                            <textarea value={edit.description} rows={2}
                              onChange={e => updateEdit(key, { description: e.target.value })}
                              className="w-full px-2 py-1 text-xs text-warm-gray border border-transparent hover:border-border focus:border-amber rounded-lg focus:outline-none resize-none"
                              placeholder="Short description..." />
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-warm-gray">{sym}</span>
                              <input type="number" value={edit.price} min={0}
                                onChange={e => updateEdit(key, { price: Number(e.target.value) })}
                                className="w-20 px-2 py-1 text-sm font-medium text-ink border border-border rounded-lg focus:outline-none focus:border-amber" />
                              <input type="text" value={edit.quantity}
                                onChange={e => updateEdit(key, { quantity: e.target.value })}
                                className="w-24 px-2 py-1 text-xs text-warm-gray border border-border rounded-lg focus:outline-none focus:border-amber"
                                placeholder="Qty (1kg, 6pc)" />
                              <input type="text" value={edit.category}
                                onChange={e => updateEdit(key, { category: e.target.value })}
                                className="flex-1 px-2 py-1 text-xs text-warm-gray border border-transparent hover:border-border focus:border-amber rounded-lg focus:outline-none"
                                placeholder="Category" />
                            </div>
                          </div>

                          {/* Remove */}
                          <button onClick={() => {
                            setSelectedProducts(prev => { const next = new Set(prev); next.delete(key); return next; });
                            setProductEdits(prev => { const next = { ...prev }; delete next[key]; return next; });
                          }} className="flex-shrink-0 w-7 h-7 text-warm-gray hover:text-rose text-lg leading-none">
                            ✕
                          </button>
                        </div>

                        {/* Sizes / Pack sizes */}
                        <div className="px-3 pb-3">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="text-[11px] font-medium text-warm-gray">Sizes</span>
                            {/* Quick-add common sizes */}
                            {['250gm', '500gm', '1kg', '2kg'].map(size => {
                              const already = (edit.variants || []).some(v => v.label === size);
                              if (already) return null;
                              return (
                                <button key={size} onClick={() => {
                                  const variants = [...(edit.variants || []), { label: size, price: edit.price }];
                                  updateEdit(key, { variants });
                                }} className="px-2 py-0.5 text-[10px] bg-cream border border-border rounded-full text-warm-gray hover:border-amber hover:text-amber transition-colors">
                                  + {size}
                                </button>
                              );
                            })}
                            <button onClick={() => {
                              const variants = [...(edit.variants || []), { label: '', price: edit.price }];
                              updateEdit(key, { variants });
                            }} className="text-[11px] text-amber font-medium hover:underline">
                              + Custom
                            </button>
                          </div>
                          {(edit.variants || []).length > 0 && (
                            <div className="space-y-1.5">
                              {edit.variants.map((v, vi) => (
                                <div key={vi} className="flex items-center gap-2">
                                  <input type="text" value={v.label} placeholder="e.g., 250gm, 500gm, 1kg"
                                    onChange={e => {
                                      const variants = [...edit.variants]; variants[vi] = { ...v, label: e.target.value };
                                      updateEdit(key, { variants });
                                    }}
                                    className="flex-1 px-2 py-1 text-xs border border-border rounded-lg focus:outline-none focus:border-amber" />
                                  <span className="text-[10px] text-warm-gray">{sym}</span>
                                  <input type="number" value={v.price} min={0}
                                    onChange={e => {
                                      const variants = [...edit.variants]; variants[vi] = { ...v, price: Number(e.target.value) };
                                      updateEdit(key, { variants });
                                    }}
                                    className="w-16 px-2 py-1 text-xs border border-border rounded-lg focus:outline-none focus:border-amber" />
                                  <button onClick={() => {
                                    const variants = edit.variants.filter((_, i) => i !== vi);
                                    updateEdit(key, { variants });
                                  }} className="text-warm-gray hover:text-rose text-sm">✕</button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Add custom product */}
            <button onClick={() => {
              const key = `custom_${Date.now()}`;
              setProductEdits(prev => ({
                ...prev,
                [key]: { name: '', description: '', price: 0, image: null, category: '', quantity: '', variants: [], isCustom: true },
              }));
              setSelectedProducts(prev => { const next = new Set(prev); next.add(key); return next; });
            }} className="w-full py-3 rounded-xl border-2 border-dashed border-amber/40 text-amber font-semibold text-sm hover:border-amber hover:bg-amber/5 transition-colors">
              + Add Your Own Product
            </button>

            {/* Selected count + Next */}
            <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-50 bg-white/95 backdrop-blur-xl border-t border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <span className="text-ink font-semibold">{selectedProducts.size} selected</span>
                </div>
                <button onClick={() => { setStep('about'); }} className="px-4 py-3 text-warm-gray text-sm font-medium">Back</button>
                <button onClick={saveProducts}
                  disabled={saving || (selectedProducts.size === 0 && niche !== 'other')}
                  className="px-8 py-3 bg-amber text-white rounded-xl font-semibold text-base hover:bg-amber/90 disabled:opacity-40 transition-colors min-h-[48px]">
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

            {/* Delivery — multi-select */}
            <div>
              <label className="text-sm font-medium text-ink block mb-2">How do customers get orders?</label>
              <p className="text-warm-gray text-xs mb-2">Select all that apply</p>
              <div className="space-y-2">
                {[
                  { id: 'pickup' as DeliveryMode, label: 'Pickup', desc: 'Customers come to you', emoji: '🏠' },
                  { id: 'delivery' as DeliveryMode, label: 'Local Delivery', desc: 'You deliver in your city', emoji: '🛵' },
                  { id: 'shipping' as DeliveryMode, label: isIndia ? 'PAN India Shipping' : 'Nationwide Shipping', desc: isIndia ? 'Ship across India' : 'Ship across the USA', emoji: '📦' },
                ].map(d => {
                  const selected = deliveryModes.has(d.id);
                  return (
                    <button
                      key={d.id}
                      onClick={() => {
                        setDeliveryModes(prev => {
                          const next = new Set(prev);
                          if (next.has(d.id)) {
                            if (next.size > 1) next.delete(d.id); // keep at least one
                          } else {
                            next.add(d.id);
                          }
                          return next;
                        });
                      }}
                      className={`w-full flex items-center gap-3 p-3.5 rounded-xl text-left transition-all ${
                        selected
                          ? 'bg-amber/10 border-2 border-amber'
                          : 'bg-white border border-border hover:border-amber/50'
                      }`}
                    >
                      <span className="text-xl">{d.emoji}</span>
                      <div className="flex-1">
                        <span className="font-medium text-ink text-sm">{d.label}</span>
                        <span className="text-warm-gray text-xs block">{d.desc}</span>
                      </div>
                      {selected && <span className="text-amber text-lg">✓</span>}
                    </button>
                  );
                })}
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
                  onChange={(e) => { markEdited('whatsapp'); setWhatsapp(e.target.value); }}
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

            {/* ── Editable Knowledge Base / FAQ ── */}
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => setKbExpanded(!kbExpanded)}
                className="w-full flex items-center justify-between p-4"
              >
                <div>
                  <p className="text-xs text-amber font-bold tracking-wider">AI KNOWLEDGE BASE</p>
                  <p className="text-warm-gray text-[11px] mt-0.5">
                    {kbLoading ? 'Generating FAQs for your WhatsApp bot...' :
                     knowledgeEntries.length > 0 ? `${knowledgeEntries.length} Q&A pairs — tap to review & edit` :
                     'Will be generated from your products'}
                  </p>
                </div>
                <span className="text-warm-gray text-sm">{kbExpanded ? '▲' : '▼'}</span>
              </button>

              {kbLoading && (
                <div className="px-4 pb-4 flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-amber border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-warm-gray">AI is writing FAQs your bot will use to answer customers...</span>
                </div>
              )}

              {kbExpanded && !kbLoading && knowledgeEntries.length > 0 && (
                <div className="px-4 pb-4 space-y-3">
                  <p className="text-[11px] text-warm-gray">
                    Edit answers so your WhatsApp bot gives accurate replies. Delete any you don't want.
                  </p>
                  {knowledgeEntries.map((entry, idx) => (
                    <div key={entry.id || idx} className="border border-border rounded-lg p-2.5 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <span className="text-amber text-xs font-bold mt-0.5">Q</span>
                        <input
                          type="text"
                          value={entry.question}
                          onChange={e => {
                            setKnowledgeEntries(prev => prev.map((ent, i) =>
                              i === idx ? { ...ent, question: e.target.value } : ent
                            ));
                          }}
                          className="flex-1 text-xs font-medium text-ink border-none focus:outline-none bg-transparent"
                        />
                        <button
                          onClick={() => setKnowledgeEntries(prev => prev.filter((_, i) => i !== idx))}
                          className="text-warm-gray hover:text-rose text-sm flex-shrink-0 leading-none"
                        >✕</button>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-green text-xs font-bold mt-0.5">A</span>
                        <textarea
                          value={entry.answer}
                          rows={2}
                          onChange={e => {
                            setKnowledgeEntries(prev => prev.map((ent, i) =>
                              i === idx ? { ...ent, answer: e.target.value } : ent
                            ));
                          }}
                          className="flex-1 text-xs text-warm-gray border-none focus:outline-none bg-transparent resize-none"
                        />
                      </div>
                    </div>
                  ))}
                  {/* Add custom FAQ */}
                  <button
                    onClick={() => setKnowledgeEntries(prev => [...prev, { question: '', answer: '' }])}
                    className="w-full py-2 rounded-lg border border-dashed border-amber/40 text-amber text-xs font-medium hover:border-amber hover:bg-amber/5 transition-colors"
                  >
                    + Add Your Own Q&A
                  </button>
                </div>
              )}
            </div>

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
            <div className="text-center pt-6 pb-2">
              <div className="text-5xl mb-3">🎉</div>
              <h2 className="font-display text-2xl font-black text-ink mb-1">Your shop is live!</h2>
              <p className="text-warm-gray text-sm">Share your launch post & start getting orders</p>
            </div>

            {/* Launch Post Flyer */}
            <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
              <p className="text-xs text-amber font-bold tracking-wider px-4 pt-4 pb-2">YOUR LAUNCH POST</p>
              <div className="px-4 pb-3 relative">
                {/* Skeleton loader while image loads */}
                <div className="aspect-square rounded-xl bg-gradient-to-br from-amber/10 to-cream flex items-center justify-center" id="flyer-skeleton">
                  <div className="text-center">
                    <div className="w-8 h-8 border-3 border-amber border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-warm-gray text-xs">Creating your flyer...</p>
                  </div>
                </div>
                <img
                  src={`/api/launch-post?slug=${slug}&t=${Date.now()}`}
                  alt="Launch flyer"
                  className="w-full rounded-xl shadow-md"
                  loading="eager"
                  onLoad={(e) => {
                    // Hide skeleton when image loads
                    const skeleton = document.getElementById('flyer-skeleton');
                    if (skeleton) skeleton.style.display = 'none';
                    (e.target as HTMLImageElement).style.display = 'block';
                  }}
                  style={{ display: 'none' }}
                />
              </div>

              {/* Share text — short & punchy */}
              <div className="mx-4 mb-3 bg-cream rounded-xl p-3">
                <p className="text-sm text-ink whitespace-pre-line" id="share-text">
                  {`${businessName} is now on Klovi! ${aiProfile?.tagline ? aiProfile.tagline + ' ' : ''}Order here:\nhttps://kloviapp.com/${slug}`}
                </p>
              </div>

              {/* Share buttons */}
              <div className="px-4 pb-4 space-y-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${businessName} is now on Klovi! ${aiProfile?.tagline ? aiProfile.tagline + ' ' : ''}Order here: https://kloviapp.com/${slug}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 bg-green text-white rounded-xl font-semibold text-base flex items-center justify-center gap-2 hover:bg-green/90 transition-colors min-h-[52px]"
                >
                  Share on WhatsApp
                </a>
                <div className="flex gap-2">
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`https://kloviapp.com/${slug}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-3 bg-blue/10 text-blue rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-blue/20 transition-colors"
                  >
                    Facebook
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(
                        `${businessName} is now on Klovi! Order here: https://kloviapp.com/${slug}`
                      );
                    }}
                    className="flex-1 py-3 bg-cream text-ink rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 border border-border hover:bg-amber/10 transition-colors"
                  >
                    Copy Link
                  </button>
                </div>
                <button
                  onClick={async () => {
                    try {
                      const imgRes = await fetch(`/api/launch-post?slug=${slug}&t=${Date.now()}`);
                      const blob = await imgRes.blob();
                      const file = new File([blob], `${slug}-launch.png`, { type: 'image/png' });
                      if (navigator.share) {
                        await navigator.share({
                          title: `${businessName} is LIVE!`,
                          text: `Check out ${businessName} on Klovi! Order: https://kloviapp.com/${slug}`,
                          files: [file],
                        });
                      } else {
                        // Fallback: download the image
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = `${slug}-launch.png`;
                        a.click(); URL.revokeObjectURL(url);
                      }
                    } catch {}
                  }}
                  className="w-full py-3 text-amber text-sm font-semibold hover:text-amber/80 transition-colors"
                >
                  📥 Download Flyer Image
                </button>
              </div>
            </div>

            {/* Shop URL */}
            <div className="bg-white rounded-2xl border border-border p-4 text-center">
              <p className="text-xs text-warm-gray mb-1">Your shop link</p>
              <p className="font-display text-lg font-black text-amber break-all mb-3">
                kloviapp.com/{slug}
              </p>
              <button
                onClick={() => navigator.clipboard?.writeText(`https://kloviapp.com/${slug}`)}
                className="px-5 py-2 bg-cream text-ink rounded-xl text-sm font-medium border border-border hover:bg-amber/10 transition-colors"
              >
                Copy Link
              </button>
            </div>

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
