'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BUSINESS_TYPE_TO_CATEGORIES } from '@/data/product-catalog';
import { t } from '@/lib/i18n';

// Local type matching DB catalog_products shape (camelCase)
interface CatalogProduct {
  name: string;
  category: string;
  parentCategory: string;
  title: string;
  description: string;
  highlights: string;
  variants: string[];
  quantity: string;
  priceMin: number;
  priceMax: number;
  dietary: string[];
  pexelsQuery?: string;
  imageUrl?: string;
}

type Step = 'setup' | 'products' | 'import' | 'channels' | 'preview' | 'live';

interface Variant { label: string; price: number; qty: number | null; }
interface Product {
  name: string; description: string; price: number;
  category: string; highlight: string;
  variants: Variant[]; stock: number | null;
  image: string | null;
  ingredients: string[];
}

const FOOD_TYPES = ['Snacks', 'Bakery', 'Meals / Tiffin', 'Full Kitchen'];

// ─── Mic Button ─────────────────────────────────────────────────────────────
function MicButton({ onTranscript, lang = 'en', small = false }: { onTranscript: (t: string) => void; lang?: string; small?: boolean }) {
  const [rec, setRec] = useState(false);
  const mr = useRef<MediaRecorder | null>(null);
  const ch = useRef<Blob[]>([]);
  const start = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(s); mr.current = r; ch.current = [];
      r.ondataavailable = (e) => { if (e.data.size > 0) ch.current.push(e.data); };
      r.onstop = async () => {
        s.getTracks().forEach(t => t.stop());
        const fd = new FormData(); fd.append('audio', new Blob(ch.current, { type: 'audio/webm' }), 'r.webm');
        fd.append('language', lang === 'hi' ? 'hi' : lang === 'es' ? 'es' : 'en');
        try { const res = await fetch('/api/ai/voice', { method: 'POST', body: fd }); if (res.ok) { const { text } = await res.json(); if (text) onTranscript(text); } } catch {}
      };
      r.start(); setRec(true);
    } catch {}
  };
  const stop = () => { mr.current?.stop(); setRec(false); };
  const sz = small ? 'w-9 h-9' : 'w-12 h-12';
  return (
    <button type="button" onMouseDown={start} onMouseUp={stop} onTouchStart={start} onTouchEnd={stop}
      className={`${sz} rounded-full flex items-center justify-center flex-shrink-0 transition-all ${rec ? 'bg-rose text-white scale-110 animate-pulse' : 'bg-cream text-warm-gray hover:bg-amber/20'}`} title="Hold to speak">
      <svg width={small ? 16 : 20} height={small ? 16 : 20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
      </svg>
    </button>
  );
}

// ─── Constants ──────────────────────────────────────────────────────────────
const CATEGORY_MAP: Record<string, string[]> = {
  'Snacks': ['Namkeen', 'Chips', 'Sweets', 'Savory', 'Drinks'],
  'Bakery': ['Cookies', 'Cakes', 'Pastries', 'Breads', 'Cupcakes'],
  'Meals / Tiffin': ['Lunch', 'Dinner', 'Breakfast', 'Snacks', 'Combos'],
  'Full Kitchen': ['Starters', 'Main Course', 'Desserts', 'Drinks', 'Combos'],
  'Coaching': ['1-on-1', 'Group', 'Online', 'In-Person', 'Packages'],
  'Jewelry': ['Rings', 'Necklaces', 'Earrings', 'Bangles', 'Bracelets'],
  'Astrology': ['Readings', 'Horoscope', 'Consultation', 'Reports', 'Packages'],
  'Healing / Wellness': ['Reiki', 'Crystal', 'Meditation', 'Yoga', 'Packages'],
  'Beauty / Mehndi': ['Bridal', 'Party', 'Casual', 'Nail Art', 'Packages'],
  'Crafts / Art': ['Paintings', 'Handmade', 'Custom', 'Home Decor', 'Gifts'],
  'Fitness': ['Personal Training', 'Group Class', 'Online', 'Diet Plan', 'Packages'],
};

const CARD_BG = [
  'from-orange-50 to-yellow-100', 'from-pink-50 to-red-50',
  'from-sky-50 to-indigo-50', 'from-emerald-50 to-cyan-50',
  'from-violet-50 to-fuchsia-50', 'from-yellow-50 to-orange-50',
  'from-red-50 to-pink-50', 'from-cyan-50 to-sky-50',
];

const EMOJI: Record<string, string> = {
  'Namkeen': '🍘', 'Chips': '🍟', 'Sweets': '🍬', 'Savory': '🥨', 'Drinks': '🥤',
  'Cookies': '🍪', 'Cakes': '🎂', 'Pastries': '🥐', 'Breads': '🍞', 'Cupcakes': '🧁',
  'Lunch': '🍱', 'Dinner': '🍛', 'Breakfast': '🥞', 'Snacks': '🍿', 'Combos': '🍽️',
  'Starters': '🥗', 'Main Course': '🍲', 'Desserts': '🍰',
  '1-on-1': '👤', 'Group': '👥', 'Online': '💻', 'In-Person': '🏫', 'Packages': '📦',
  'Rings': '💍', 'Necklaces': '📿', 'Earrings': '✨', 'Bangles': '⭕', 'Bracelets': '🔗',
  'Readings': '🔮', 'Horoscope': '⭐', 'Consultation': '🗣️', 'Reports': '📋',
  'Reiki': '✋', 'Crystal': '💎', 'Meditation': '🧘', 'Yoga': '🧘‍♀️',
  'Bridal': '👰', 'Party': '🎉', 'Casual': '💅', 'Nail Art': '💅',
  'Paintings': '🖼️', 'Handmade': '🧶', 'Custom': '✂️', 'Home Decor': '🏠', 'Gifts': '🎁',
  'Personal Training': '🏋️', 'Group Class': '👥', 'Diet Plan': '🥗',
};
const getEmoji = (cat: string) => EMOJI[cat] || '🛍️';

const VARIANT_SUGGESTIONS = ['100g', '200g', '250g', '500g', '1kg', 'Small', 'Medium', 'Large', 'Custom'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('setup');
  const [saving, setSaving] = useState(false);
  const [sellerId, setSellerId] = useState('');
  const [slug, setSlug] = useState('');

  // Setup
  const [language, setLanguage] = useState('en');
  const [businessTypes, setBusinessTypes] = useState<string[]>([]);
  const [customType, setCustomType] = useState('');
  const [city, setCity] = useState('');
  const [currency, setCurrency] = useState('USD');
  const currencySymbol = currency === 'INR' ? '₹' : '$';
  const businessType = businessTypes.join(', ');  // for APIs
  const isFoodBusiness = businessTypes.some(bt => FOOD_TYPES.includes(bt));

  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  // Import
  const [extracting, setExtracting] = useState(false);
  const [reviewProducts, setReviewProducts] = useState<(Product & { selected: boolean })[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerEditIdx, setDrawerEditIdx] = useState<number | null>(null);
  const [dName, setDName] = useState('');
  const [dDesc, setDDesc] = useState('');
  const [dPrice, setDPrice] = useState('');
  const [dCategory, setDCategory] = useState('');
  const [dQty, setDQty] = useState('');
  const [dVariants, setDVariants] = useState<Variant[]>([]);
  const [dImage, setDImage] = useState<string | null>(null);
  const [dIngredients, setDIngredients] = useState<string[]>([]);
  const [dAiSuggesting, setDAiSuggesting] = useState(false);
  const [dGeneratingImage, setDGeneratingImage] = useState(false);
  const [dPexelsPhotos, setDPexelsPhotos] = useState<{ id: number; src: string; thumb: string }[]>([]);
  const [dSearchingPhotos, setDSearchingPhotos] = useState(false);
  const dSuggestTimer = useRef<NodeJS.Timeout | null>(null);
  const dNameRef = useRef<HTMLInputElement>(null);
  const drawerPhotoRef = useRef<HTMLInputElement>(null);
  const dImageRef = useRef<string | null>(null);

  // List interactions
  const [swipedIdx, setSwipedIdx] = useState<number | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const lightboxTouchY = useRef(0);

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [fulfillmentMode, setFulfillmentMode] = useState('pickup');
  const [pickupAddress, setPickupAddress] = useState('');

  // Import Data step
  const [importingInventory, setImportingInventory] = useState(false);
  const [importedProducts, setImportedProducts] = useState<(Product & { selected: boolean })[]>([]);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const inventoryFileRef = useRef<HTMLInputElement>(null);
  const [importingCustomers, setImportingCustomers] = useState(false);
  const customerFileRef = useRef<HTMLInputElement>(null);
  interface ImportedCustomer { name: string; phone: string; notes: string; orderCount?: number; }
  const [importedCustomers, setImportedCustomers] = useState<ImportedCustomer[]>([]);
  const [showCustomerInsights, setShowCustomerInsights] = useState(false);
  const [customerInsights, setCustomerInsights] = useState<{ total: number; topCustomer?: string; topCount?: number; inactive?: number; birthdays?: number }>({ total: 0 });
  const [waDrawerOpen, setWaDrawerOpen] = useState(false);
  const [waChatText, setWaChatText] = useState('');
  const [extractingChat, setExtractingChat] = useState(false);
  const [extractedFromChat, setExtractedFromChat] = useState<ImportedCustomer[]>([]);
  const [manualDrawerOpen, setManualDrawerOpen] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  // Channels sub-steps
  const [channelStep, setChannelStep] = useState(1); // 1=payment, 2=channels, 3=brand
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [upiId, setUpiId] = useState('');
  const [upiQr, setUpiQr] = useState<string | null>(null);
  const [zelleId, setZelleId] = useState('');
  const [whatsappPath, setWhatsappPath] = useState<'klovi' | 'own'>('klovi');
  const [ownWhatsapp, setOwnWhatsapp] = useState('');
  const [igHandle, setIgHandle] = useState('');
  const [fbPage, setFbPage] = useState('');
  const [generatingPost, setGeneratingPost] = useState(false);
  const [launchPost, setLaunchPost] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState('');
  const upiQrRef = useRef<HTMLInputElement>(null);

  // Catalog picker
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState<string | null>(null);
  const [catalogSelected, setCatalogSelected] = useState<Set<string>>(new Set());
  const [catalogPhotos, setCatalogPhotos] = useState<Record<string, string>>({});
  const catalogPhotosFetched = useRef<Set<string>>(new Set());

  // DB-fetched catalog data (replaces static imports)
  const [dbCategories, setDbCategories] = useState<{id: number; name: string; emoji: string; color: string}[]>([]);
  const [dbProducts, setDbProducts] = useState<CatalogProduct[]>([]);

  // AI-generated catalog for custom business types
  const [aiCatalogProducts, setAiCatalogProducts] = useState<CatalogProduct[]>([]);
  const [aiCatalogCategories, setAiCatalogCategories] = useState<{ id: number; name: string; emoji: string; color: string }[]>([]);
  const [generatingCatalog, setGeneratingCatalog] = useState(false);
  const aiCatalogGenerated = useRef<string>(''); // track what type we generated for

  // Fetch catalog categories and products from Supabase on mount
  useEffect(() => {
    const fetchCatalog = async () => {
      const supabase = createClient();
      const [catRes, prodRes] = await Promise.all([
        supabase.from('catalog_categories').select('id, name, emoji, color').eq('enabled', true).order('sort_order'),
        supabase.from('catalog_products').select('*').eq('enabled', true).order('sort_order'),
      ]);
      if (catRes.data) setDbCategories(catRes.data);
      if (prodRes.data) {
        setDbProducts(prodRes.data.map((p: any) => ({
          name: p.name,
          category: p.category,
          parentCategory: p.parent_category,
          title: p.title,
          description: p.description || '',
          highlights: p.highlights || '',
          variants: p.variants || [],
          quantity: p.quantity || '',
          priceMin: p.price_min || 0,
          priceMax: p.price_max || 0,
          dietary: p.dietary || [],
          pexelsQuery: p.pexels_query || undefined,
          imageUrl: p.image_url || undefined,
        })));
      }
    };
    fetchCatalog();
  }, []);

  // Get relevant catalog categories based on business types
  // Check if we have mapped categories from known business types
  const hasMappedCategories = useMemo(() => {
    const catNames = new Set<string>();
    businessTypes.forEach(bt => {
      (BUSINESS_TYPE_TO_CATEGORIES[bt] || []).forEach(c => catNames.add(c));
    });
    if (customType) {
      const words = customType.toLowerCase().split(/[\s,]+/).filter(Boolean);
      dbCategories.forEach(cat => {
        const catLower = cat.name.toLowerCase();
        if (words.some(w => catLower.includes(w) || w.includes(catLower.split(' ')[0].toLowerCase()))) {
          catNames.add(cat.name);
        }
      });
    }
    return catNames.size > 0;
  }, [businessTypes, customType, dbCategories]);

  const relevantCategories = useMemo(() => {
    const catNames = new Set<string>();
    businessTypes.forEach(bt => {
      (BUSINESS_TYPE_TO_CATEGORIES[bt] || []).forEach(c => catNames.add(c));
    });
    if (customType) {
      const words = customType.toLowerCase().split(/[\s,]+/).filter(Boolean);
      dbCategories.forEach(cat => {
        const catLower = cat.name.toLowerCase();
        if (words.some(w => catLower.includes(w) || w.includes(catLower.split(' ')[0].toLowerCase()))) {
          catNames.add(cat.name);
        }
      });
    }
    // Use pre-built categories if matched, otherwise use AI-generated ones
    if (catNames.size > 0) return dbCategories.filter(c => catNames.has(c.name));
    return aiCatalogCategories;
  }, [businessTypes, customType, dbCategories, aiCatalogCategories]);

  const filteredCatalogProducts = useMemo(() => {
    const catNames = new Set<string>();
    businessTypes.forEach(bt => {
      (BUSINESS_TYPE_TO_CATEGORIES[bt] || []).forEach(c => catNames.add(c));
    });
    if (customType) {
      const words = customType.toLowerCase().split(/[\s,]+/).filter(Boolean);
      dbCategories.forEach(cat => {
        const catLower = cat.name.toLowerCase();
        if (words.some(w => catLower.includes(w) || w.includes(catLower.split(' ')[0].toLowerCase()))) {
          catNames.add(cat.name);
        }
      });
    }
    let prods: CatalogProduct[];
    if (catNames.size > 0) {
      prods = dbProducts.filter(p => catNames.has(p.parentCategory));
    } else {
      prods = aiCatalogProducts; // use AI-generated products
    }
    if (catalogFilter) prods = prods.filter(p => p.parentCategory === catalogFilter);
    return prods;
  }, [businessTypes, catalogFilter, customType, dbCategories, dbProducts, aiCatalogProducts]);

  // Generate AI catalog for custom/unknown business types
  const generateAiCatalog = useCallback(async () => {
    const typeKey = customType.trim() || businessTypes.filter(bt => !BUSINESS_TYPE_TO_CATEGORIES[bt]).join(', ');
    if (!typeKey || typeKey === aiCatalogGenerated.current) return;
    setGeneratingCatalog(true);
    try {
      const res = await fetch('/api/ai/generate-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessType: typeKey, city, country: currency === 'INR' ? 'india' : 'usa' }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      if (data.products?.length > 0) {
        // Extract unique categories from AI response
        const catSet = new Set<string>();
        const catalogProds: CatalogProduct[] = data.products.map((p: any) => {
          const cat = p.category || typeKey;
          catSet.add(cat);
          return {
            name: p.name,
            category: cat,
            parentCategory: cat,
            title: p.name,
            description: p.description || '',
            highlights: p.highlight || '',
            variants: p.variants || [],
            quantity: '',
            priceMin: p.priceMin || 0,
            priceMax: p.priceMax || 0,
            dietary: [],
            _pexelsQuery: p.pexelsQuery, // stash for photo fetching
          } as CatalogProduct & { _pexelsQuery?: string };
        });
        const catArr = Array.from(catSet).map((name, i) => ({
          id: 100 + i,
          name,
          emoji: '✨',
          color: ['FCD34D', 'C4B5FD', 'FCA5A5', '86EFAC', '93C5FD', 'FDE68A'][i % 6],
        }));
        setAiCatalogCategories(catArr);
        setAiCatalogProducts(catalogProds);
        aiCatalogGenerated.current = typeKey;

        // Fetch Pexels photos for AI-generated products
        for (const prod of catalogProds) {
          const query = (prod as any)._pexelsQuery || prod.name;
          try {
            const pRes = await fetch(`/api/photos/search?q=${encodeURIComponent(query)}&per_page=1`);
            if (pRes.ok) {
              const pData = await pRes.json();
              if (pData.photos?.[0]?.src) {
                setCatalogPhotos(prev => ({ ...prev, [prod.name]: pData.photos[0].src }));
              }
            }
          } catch {}
        }
      }
    } catch {}
    setGeneratingCatalog(false);
  }, [customType, businessTypes, city, currency]);

  // Fetch Pexels photos for all visible catalog products
  useEffect(() => {
    if (!catalogOpen) return;
    // Pre-populate catalogPhotos with DB imageUrl (founder-uploaded images)
    const dbImageUpdates: Record<string, string> = {};
    filteredCatalogProducts.forEach(p => {
      if (p.imageUrl && !catalogPhotos[p.name]) {
        dbImageUpdates[p.name] = p.imageUrl;
        catalogPhotosFetched.current.add(p.name); // skip Pexels for these
      }
    });
    if (Object.keys(dbImageUpdates).length > 0) setCatalogPhotos(prev => ({ ...prev, ...dbImageUpdates }));

    const toFetch = filteredCatalogProducts
      .filter(p => !catalogPhotosFetched.current.has(p.name));
    if (toFetch.length === 0) return;
    toFetch.forEach(p => catalogPhotosFetched.current.add(p.name));
    const fetchBatch = async (batch: CatalogProduct[]) => {
      const results = await Promise.allSettled(
        batch.map(async (p) => {
          // Use pexelsQuery if available, otherwise construct a better query
          const q = p.pexelsQuery || `${p.name} ${p.parentCategory === 'Homemade Sweets' ? 'indian sweet' : p.parentCategory === 'Pickles & Achar' ? 'indian pickle jar' : p.parentCategory === 'Healthy Snacks' ? 'healthy snack' : p.parentCategory === 'Masala & Spice Mixes' ? 'indian spice' : p.parentCategory === 'Tiffin Service' ? 'indian meal box' : p.parentCategory === "Women's Stitching" ? 'tailoring sewing' : ''}`;
          const res = await fetch(`/api/photos/search?q=${encodeURIComponent(q)}&per_page=1`);
          if (res.ok) {
            const data = await res.json();
            if (data.photos?.[0]?.src) return { name: p.name, src: data.photos[0].src };
          }
          return null;
        })
      );
      const updates: Record<string, string> = {};
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value) updates[r.value.name] = r.value.src;
      });
      if (Object.keys(updates).length > 0) setCatalogPhotos(prev => ({ ...prev, ...updates }));
    };
    (async () => {
      for (let i = 0; i < toFetch.length; i += 3) {
        await fetchBatch(toFetch.slice(i, i + 3));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogOpen, filteredCatalogProducts]);

  const addCatalogProducts = () => {
    // Search both pre-built AND AI-generated products
    const allCatalog = [...dbProducts, ...aiCatalogProducts];
    const selected = allCatalog.filter(p => catalogSelected.has(p.name));
    const newProds: Product[] = selected.map(cp => ({
      name: cp.name,
      description: cp.description,
      price: cp.priceMin,
      category: cp.category,
      highlight: cp.highlights,
      variants: cp.variants.map(v => ({ label: v, price: 0, qty: null })),
      stock: null,
      image: cp.imageUrl || catalogPhotos[cp.name] || null,
      ingredients: [],
    }));
    setProducts(prev => [...prev, ...newProds]);
    const newCats = new Set(categories);
    newProds.forEach(p => { if (p.category && !newCats.has(p.category)) newCats.add(p.category); });
    setCategories(Array.from(newCats));
    setCatalogOpen(false);
    setCatalogSelected(new Set());
    setCatalogFilter(null);
  };

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/auth/login'); return; }
      const { data: seller } = await supabase.from('sellers').select('id, slug, city, business_name').eq('user_id', user.id).single();
      if (seller) {
        setSellerId(seller.id);
        setSlug(seller.slug);
        if (seller.city) setCity(seller.city);
        if (seller.business_name) setBusinessName(seller.business_name);
      }
    })();
    navigator.geolocation?.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
          const data = await res.json();
          const c = data.address?.city || data.address?.town || data.address?.village || '';
          const s = data.address?.state || '';
          const cc = data.address?.country_code;
          if (c) setCity(prev => prev || (s ? `${c}, ${s}` : c));
          if (cc === 'in') setCurrency('INR');
        } catch {}
      }, () => {}, { timeout: 5000 }
    );
  }, [router]);

  useEffect(() => {
    const allCats = new Set<string>();
    businessTypes.forEach(bt => {
      (CATEGORY_MAP[bt] || []).forEach(c => allCats.add(c));
    });
    if (allCats.size > 0) setCategories(Array.from(allCats));
  }, [businessTypes]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const makeProduct = useCallback((raw: Record<string, unknown>): Product => ({
    name: String(raw.name || ''),
    description: raw.description ? String(raw.description) : '',
    price: typeof raw.price === 'number' ? raw.price : parseFloat(String(raw.price)) || 0,
    category: raw.category ? String(raw.category) : categories[0] || '',
    highlight: raw.highlight ? String(raw.highlight) : '',
    variants: Array.isArray(raw.variants)
      ? raw.variants.map((v: Record<string, unknown>) => ({ label: String(v.label || v.name || ''), price: typeof v.price === 'number' ? v.price : parseFloat(String(v.price)) || 0, qty: null }))
      : [],
    stock: null,
    image: null,
    ingredients: Array.isArray(raw.ingredients) ? raw.ingredients.map(String) : [],
  }), [categories]);

  const updateProduct = (i: number, p: Product) => setProducts(prev => prev.map((x, idx) => idx === i ? p : x));
  const removeProduct = (i: number) => { setProducts(prev => prev.filter((_, idx) => idx !== i)); setSwipedIdx(null); };

  // ─── Drawer ───────────────────────────────────────────────────────────────
  const openDrawerAdd = () => {
    setDrawerEditIdx(null);
    setDName(''); setDDesc(''); setDPrice(''); setDCategory(''); setDQty('');
    setDVariants([]); setDImage(null); dImageRef.current = null; setDIngredients([]);
    setDPexelsPhotos([]); setDSearchingPhotos(false);
    setDrawerOpen(true);
    setTimeout(() => dNameRef.current?.focus(), 300);
  };

  const openDrawerEdit = (idx: number) => {
    const p = products[idx];
    setDrawerEditIdx(idx);
    setDName(p.name); setDDesc(p.description); setDPrice(String(p.price || ''));
    setDCategory(p.category); setDQty(p.stock !== null ? String(p.stock) : '');
    setDVariants(p.variants.map(v => ({ ...v }))); setDImage(p.image); dImageRef.current = p.image;
    setDIngredients([...p.ingredients]);
    setDrawerOpen(true);
  };

  const closeDrawer = () => setDrawerOpen(false);

  const saveDrawer = () => {
    if (!dName.trim()) return;
    const product: Product = {
      name: dName.trim(), description: dDesc.trim(),
      price: dVariants.length > 0 ? 0 : parseFloat(dPrice) || 0,
      category: dCategory || categories[0] || '', highlight: '',
      variants: dVariants.filter(v => v.label.trim()),
      stock: dQty ? parseInt(dQty) : null, image: dImage,
      ingredients: dIngredients.filter(i => i.trim()),
    };
    if (drawerEditIdx !== null) {
      updateProduct(drawerEditIdx, product);
    } else {
      setProducts(prev => [...prev, product]);
    }
    closeDrawer();
  };

  // ─── Search Pexels for product photos ──────────────────────────────
  const searchPexelsPhotos = async (name: string) => {
    setDSearchingPhotos(true);
    setDPexelsPhotos([]);
    try {
      const q = name;
      const res = await fetch(`/api/photos/search?q=${encodeURIComponent(q)}&per_page=4`);
      if (res.ok) {
        const data = await res.json();
        setDPexelsPhotos(data.photos || []);
      }
    } catch {}
    setDSearchingPhotos(false);
  };

  // ─── Generate product image (user-triggered) ──────────────────────────
  const generateImage = async (productName: string, cat: string) => {
    setDGeneratingImage(true);
    try {
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: productName, category: cat }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.image) {
          setDImage(data.image);
          dImageRef.current = data.image;
        }
      }
    } catch {}
    setDGeneratingImage(false);
  };

  // ─── Drawer AI suggest ────────────────────────────────────────────────────
  const triggerDrawerSuggest = (name: string, immediate = false) => {
    if (dSuggestTimer.current) clearTimeout(dSuggestTimer.current);
    if (!name.trim() || name.trim().length < 3) return;
    const doSuggest = async () => {
      setDAiSuggesting(true);
      try {
        const res = await fetch('/api/ai/suggest-product', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), businessType, city }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.description) setDDesc(prev => prev || data.description);
          if (data.category) setDCategory(prev => prev || data.category);
          if (data.ingredients?.length > 0 && isFoodBusiness) setDIngredients(prev => prev.length > 0 ? prev : data.ingredients);
        }
      } catch {}
      setDAiSuggesting(false);
    };
    if (immediate) doSuggest();
    else dSuggestTimer.current = setTimeout(doSuggest, 800);
  };

  // ─── Drawer photo ─────────────────────────────────────────────────────────
  const handleDrawerPhoto = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setDImage(url);
      dImageRef.current = url;
    };
    reader.readAsDataURL(file);
  };

  // ─── Bulk Photo Import ────────────────────────────────────────────────────
  const handleBulkPhoto = async (file: File) => {
    setExtracting(true);
    const fd = new FormData(); fd.append('image', file);
    try {
      const res = await fetch('/api/ai/extract-menu', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.products?.length > 0) {
        setReviewProducts(data.products.map((p: Record<string, unknown>) => ({ ...makeProduct(p), selected: true })));
        setShowReview(true);
      } else alert(data.error || 'Could not read products. Try a clearer photo.');
    } catch { alert('Something went wrong.'); }
    setExtracting(false);
    if (bulkFileRef.current) bulkFileRef.current.value = '';
  };

  // ─── Voice Recording ─────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder; chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setRecording(false); setExtracting(true);
        const fd = new FormData();
        fd.append('audio', new Blob(chunksRef.current, { type: 'audio/webm' }), 'menu.webm');
        fd.append('language', language === 'hi' ? 'hi' : language === 'es' ? 'es' : 'en');
        try {
          const wRes = await fetch('/api/ai/voice', { method: 'POST', body: fd });
          if (wRes.ok) {
            const { text } = await wRes.json();
            if (text) {
              const eRes = await fetch('/api/ai/extract-menu', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: text }),
              });
              const data = await eRes.json();
              if (data.products?.length > 0) {
                setReviewProducts(data.products.map((p: Record<string, unknown>) => ({ ...makeProduct(p), selected: true })));
                setShowReview(true);
              } else alert('Could not extract products. Try speaking more clearly with prices.');
            }
          }
        } catch {}
        setExtracting(false);
      };
      recorder.start(); setRecording(true);
    } catch { alert('Could not access microphone.'); }
  };
  const stopRecording = () => { recorderRef.current?.stop(); };

  // ─── Confirm review ──────────────────────────────────────────────────────
  const confirmReview = () => {
    const selected = reviewProducts.filter(p => p.selected);
    const newProds: Product[] = selected.map(({ selected: _, ...p }) => p);
    setProducts(prev => [...prev, ...newProds]);
    const newCats = new Set(categories);
    newProds.forEach(p => { if (p.category && !newCats.has(p.category)) newCats.add(p.category); });
    setCategories(Array.from(newCats));
    setReviewProducts([]); setShowReview(false);
  };

  // ─── Swipe to delete ─────────────────────────────────────────────────────
  const handleRowTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const handleRowTouchEnd = (e: React.TouchEvent, idx: number) => {
    if (!touchStartRef.current) return;
    const dx = touchStartRef.current.x - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartRef.current.y - e.changedTouches[0].clientY);
    if (dx > 60 && dy < 30) setSwipedIdx(idx);
    else if (dx < -30) setSwipedIdx(null);
    touchStartRef.current = null;
  };

  // ─── Save ─────────────────────────────────────────────────────────────────
  const saveSetup = async () => {
    if (businessTypes.length === 0 || !city.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const text = (businessTypes.join(' ') + ' ' + customType).toLowerCase();
    let category = 'services';
    if (text.match(/stitch|tailor|sew/)) category = 'stitching';
    else if (text.match(/snack|bak|cook|food|tiffin|meal|kitchen|sweet/)) category = 'food';
    else if (text.match(/coach|tutor/)) category = 'tutoring';
    else if (text.match(/jewel/)) category = 'jewelry';
    else if (text.match(/beauty|mehnd/)) category = 'beauty';
    else if (text.match(/craft|art/)) category = 'crafts';
    else if (text.match(/cloth|fashion/)) category = 'clothing';
    else if (text.match(/fit|yoga/)) category = 'fitness';
    else if (text.match(/astro|heal|well|spirit/)) category = 'wellness';
    else if (text.match(/plant|garden/)) category = 'plants';
    const fullDesc = customType ? [...businessTypes, customType].join(', ') : businessTypes.join(', ');
    await supabase.from('sellers').update({ language, category, description: fullDesc, city: city.trim() }).eq('id', sellerId);
    setSaving(false); setStep('products');
  };

  const saveEverything = async () => {
    if (products.length === 0) return;
    setSaving(true);
    const supabase = createClient();
    const { data: seller } = await supabase.from('sellers').select('country').eq('id', sellerId).single();
    const currency = seller?.country === 'india' ? 'INR' : 'USD';
    const inserts = products.map((p, i) => ({
      seller_id: sellerId, name: p.name, description: p.description || null,
      price: p.price, category: p.category || null, currency, sort_order: i,
      variants: p.variants.length > 0 ? JSON.stringify(p.variants) : null,
      stock_quantity: p.stock, track_stock: p.stock !== null,
      images: p.image ? [p.image] : null,
    }));
    await supabase.from('products').insert(inserts);
    const modes = fulfillmentMode === 'both' ? ['pickup', 'delivery'] : [fulfillmentMode];
    await supabase.from('sellers').update({
      fulfillment_modes: modes, pickup_address: pickupAddress || null,
      cod_enabled: paymentMethod === 'cash',
    }).eq('id', sellerId);
    setSaving(false); setStep('import');
  };

  // ─── Import Data helpers ────────────────────────────────────────────────
  const handleInventoryFile = async (file: File) => {
    setImportingInventory(true);
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await fetch('/api/ai/import-inventory', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        if (data.products?.length > 0) {
          setImportedProducts(data.products.map((p: Record<string, unknown>) => ({ ...makeProduct(p), selected: true })));
          setShowImportPreview(true);
        } else alert('Could not read products from this file. Check the format.');
      } else alert('Failed to process file.');
    } catch { alert('Something went wrong.'); }
    setImportingInventory(false);
    if (inventoryFileRef.current) inventoryFileRef.current.value = '';
  };

  const confirmImportProducts = () => {
    const selected = importedProducts.filter(p => p.selected);
    const newProds: Product[] = selected.map(({ selected: _, ...p }) => p);
    setProducts(prev => [...prev, ...newProds]);
    const newCats = new Set(categories);
    newProds.forEach(p => { if (p.category && !newCats.has(p.category)) newCats.add(p.category); });
    setCategories(Array.from(newCats));
    setImportedProducts([]); setShowImportPreview(false);
  };

  const handleCustomerFile = async (file: File) => {
    setImportingCustomers(true);
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await fetch('/api/ai/import-customers', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        if (data.customers?.length > 0) {
          setImportedCustomers(prev => [...prev, ...data.customers]);
          setCustomerInsights(data.insights || { total: data.customers.length });
          setShowCustomerInsights(true);
        } else alert('Could not read customers from this file.');
      } else alert('Failed to process file.');
    } catch { alert('Something went wrong.'); }
    setImportingCustomers(false);
    if (customerFileRef.current) customerFileRef.current.value = '';
  };

  const extractWhatsAppChat = async () => {
    if (!waChatText.trim()) return;
    setExtractingChat(true);
    try {
      const res = await fetch('/api/ai/extract-customers-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat: waChatText.trim(), businessType }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.customers?.length > 0) setExtractedFromChat(data.customers);
        else alert('Could not find customers in this chat.');
      }
    } catch { alert('Something went wrong.'); }
    setExtractingChat(false);
  };

  const confirmChatCustomers = () => {
    setImportedCustomers(prev => [...prev, ...extractedFromChat]);
    setCustomerInsights(prev => ({ ...prev, total: prev.total + extractedFromChat.length }));
    setShowCustomerInsights(true);
    setExtractedFromChat([]); setWaChatText(''); setWaDrawerOpen(false);
  };

  const saveManualCustomer = () => {
    if (!manualName.trim()) return;
    const c: ImportedCustomer = { name: manualName.trim(), phone: manualPhone.trim(), notes: manualNotes.trim() };
    setImportedCustomers(prev => [...prev, c]);
    setCustomerInsights(prev => ({ ...prev, total: prev.total + 1 }));
    setShowCustomerInsights(true);
    setManualName(''); setManualPhone(''); setManualNotes(''); setManualDrawerOpen(false);
  };

  const saveChannels = async () => {
    setSaving(true);
    const supabase = createClient();
    const updates: Record<string, unknown> = {
      status: 'active',
      cod_enabled: selectedPayments.includes('cash'),
      whatsapp_path: whatsappPath === 'klovi' ? 'shared' : 'own_number',
      whatsapp_number: whatsappPath === 'own' ? ownWhatsapp : null,
      instagram_connected: !!igHandle,
      facebook_connected: !!fbPage,
      instagram_handle: igHandle || null,
      facebook_handle: fbPage || null,
    };
    if (upiId) updates.upi_id = upiId;
    await supabase.from('sellers').update(updates).eq('id', sellerId);
    setSaving(false); setStep('preview');
  };

  // Launch post — full bleed Pexels background poster
  const CATEGORY_BG_QUERIES: Record<string, string> = {
    'Home Bakery': 'homemade chocolate cake bakery',
    'Tiffin Service': 'indian home cooked meal tiffin',
    'Homemade Sweets': 'indian mithai sweets diwali',
    'Homemade Snacks': 'indian namkeen snacks chakli',
    'Pickles & Achar': 'indian pickle achar glass jar',
    'Healthy Snacks': 'makhana nuts healthy snacks',
    'Masala & Spice Mixes': 'indian spices colorful masala',
    'Handmade Jewelry': 'handmade jewelry earrings ethnic',
    'Gift Hampers': 'luxury gift hamper box ribbon',
    'Homemade Chocolates': 'dark chocolate truffles handmade',
    'Healing & Spiritual': 'crystals candles meditation spiritual',
    'Nutrition & Weight Coaching': 'healthy food nutrition fresh',
    'Home Tutoring & Classes': 'study books learning education',
    'Natural Beauty & Skincare': 'natural skincare ingredients botanical',
    'Candles & Home Décor': 'scented candles cozy home decor',
    'Plants & Gardening': 'indoor plants succulents green',
    "Women's Stitching": 'indian blouse stitching fabric tailoring',
    'Stitching & Tailoring': 'indian blouse stitching fabric tailoring',
    'Tailoring': 'indian fabric stitching fashion tailoring',
    'Clothing & Fashion': 'indian ethnic wear fashion clothing',
  };
  const launchPostRef = useRef<HTMLDivElement>(null);
  const [postBgImages, setPostBgImages] = useState<string[]>([]);
  const [postBgIdx, setPostBgIdx] = useState(1);

  const generateLaunchPost = async () => {
    setGeneratingPost(true);
    try {
      // Find best bg query from selected categories
      const catNames = new Set<string>();
      businessTypes.forEach(bt => {
        (BUSINESS_TYPE_TO_CATEGORIES[bt] || []).forEach(c => catNames.add(c));
      });
      const firstCat = Array.from(catNames)[0] || '';
      // Dynamic fallback: use business type keywords + "indian handmade"
      const bgQuery = CATEGORY_BG_QUERIES[firstCat] || (businessType ? `${businessType} indian handmade` : 'artisan handmade beautiful');
      const res = await fetch(`/api/photos/search?q=${encodeURIComponent(bgQuery)}&per_page=5&orientation=portrait`);
      if (res.ok) {
        const data = await res.json();
        const urls = (data.photos || []).map((p: { src: string }) => p.src);
        setPostBgImages(urls);
        const idx = urls.length > 1 ? 1 : 0;
        setPostBgIdx(idx);
        // Save best background to seller profile
        if (urls[idx]) {
          const sb = createClient();
          sb.from('sellers').update({ launch_card_bg_url: urls[idx] }).eq('id', sellerId).then(() => {});
        }
      }
    } catch {}
    setLaunchPost('ready');
    setGeneratingPost(false);
  };

  const refreshPostBg = () => {
    if (postBgImages.length === 0) return;
    const nextIdx = (postBgIdx + 1) % postBgImages.length;
    setPostBgIdx(nextIdx);
    // Save new background to seller profile
    if (postBgImages[nextIdx]) {
      const sb = createClient();
      sb.from('sellers').update({ launch_card_bg_url: postBgImages[nextIdx] }).eq('id', sellerId).then(() => {});
    }
  };

  const postBgImage = postBgImages[postBgIdx] || null;

  const downloadLaunchPost = async () => {
    if (!launchPostRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(launchPostRef.current, {
        scale: 2, backgroundColor: null, useCORS: true,
      });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `${(businessName || 'my-business').replace(/\s+/g, '-').toLowerCase()}-launch.png`;
      a.click();
    } catch {
      alert('Could not download. Try taking a screenshot instead.');
    }
  };

  const handleUpiQr = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => setUpiQr(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ─── Progress ─────────────────────────────────────────────────────────────
  const stepsArr: Step[] = ['setup', 'products', 'import', 'channels', 'preview', 'live'];
  const progress = `${((stepsArr.indexOf(step) + 1) / stepsArr.length) * 100}%`;

  const BUSINESS_TYPES = [
    { icon: '🍪', label: 'Snacks' }, { icon: '🎂', label: 'Bakery' },
    { icon: '🍱', label: 'Meals / Tiffin' }, { icon: '🍳', label: 'Full Kitchen' },
    { icon: '📚', label: 'Coaching' }, { icon: '💍', label: 'Jewelry' },
    { icon: '🔮', label: 'Astrology' }, { icon: '🧘', label: 'Healing / Wellness' },
    { icon: '💅', label: 'Beauty / Mehndi' }, { icon: '🎨', label: 'Crafts / Art' },
    { icon: '💪', label: 'Fitness' }, { icon: '🧵', label: 'Stitching' }, { icon: '✨', label: 'Other' },
  ];

  // ─── Shared settings strip ────────────────────────────────────────────────
  const settingsStrip = (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <button onClick={() => setSettingsOpen(!settingsOpen)}
        className="w-full px-3 py-2 flex items-center justify-between text-xs">
        <span className="text-warm-gray">
          {currencySymbol} {currency} · {paymentMethod === 'cash' ? '💵 Cash' : paymentMethod === 'card' ? '💳 Card' : '🏦 UPI'}
          {' · '}
          {fulfillmentMode === 'pickup' ? '📍 Pickup' : fulfillmentMode === 'delivery' ? '🚗 Delivery' : '✨ Both'}
        </span>
        <span className="text-amber font-semibold text-[10px]">{settingsOpen ? '▲' : '▼'}</span>
      </button>
      {settingsOpen && (
        <div className="px-3 pb-3 border-t border-border pt-2 space-y-2">
          <div>
            <label className="text-[10px] text-warm-gray uppercase tracking-wider font-semibold mb-1 block">Currency</label>
            <div className="flex gap-1">
              {[{ c: 'USD', l: '$ USD' }, { c: 'INR', l: '₹ INR' }].map(cr => (
                <button key={cr.c} onClick={() => setCurrency(cr.c)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${currency === cr.c ? 'bg-amber/15 ring-1 ring-amber text-ink' : 'bg-cream text-warm-gray'}`}>
                  {cr.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-warm-gray uppercase tracking-wider font-semibold mb-1 block">Payment</label>
            <div className="flex gap-1">
              {[{ m: 'cash', l: '💵 Cash' }, { m: 'card', l: '💳 Card' }, { m: 'upi', l: '🏦 UPI' }].map(p => (
                <button key={p.m} onClick={() => setPaymentMethod(p.m)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${paymentMethod === p.m ? 'bg-amber/15 ring-1 ring-amber text-ink' : 'bg-cream text-warm-gray'}`}>
                  {p.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] text-warm-gray uppercase tracking-wider font-semibold mb-1 block">Fulfillment</label>
            <div className="flex gap-1">
              {[{ m: 'pickup', l: '📍 Pickup' }, { m: 'delivery', l: '🚗 Delivery' }, { m: 'both', l: '✨ Both' }].map(f => (
                <button key={f.m} onClick={() => setFulfillmentMode(f.m)}
                  className={`flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all ${fulfillmentMode === f.m ? 'bg-amber/15 ring-1 ring-amber text-ink' : 'bg-cream text-warm-gray'}`}>
                  {f.l}
                </button>
              ))}
            </div>
          </div>
          {(fulfillmentMode === 'pickup' || fulfillmentMode === 'both') && (
            <input type="text" value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)}
              className="w-full px-2 py-1.5 border border-border rounded-lg text-ink text-[10px] focus:outline-none focus:border-amber"
              placeholder="Pickup address" />
          )}
        </div>
      )}
    </div>
  );

  // ─── Product list row ─────────────────────────────────────────────────────
  const productRow = (p: Product, i: number) => (
    <div key={i} className="relative overflow-hidden" onClick={() => { if (swipedIdx === i) setSwipedIdx(null); }}>
      <div
        className={`flex items-center gap-3 px-3 py-3 bg-white transition-transform duration-200 ${swipedIdx === i ? '-translate-x-20' : ''}`}
        onTouchStart={handleRowTouchStart}
        onTouchEnd={(e) => handleRowTouchEnd(e, i)}>
        {/* Thumbnail 60x60 */}
        <div
          className={`w-[60px] h-[60px] rounded-xl flex-shrink-0 overflow-hidden cursor-pointer ${!p.image ? `bg-gradient-to-br ${CARD_BG[i % CARD_BG.length]}` : ''}`}
          onClick={(e) => { e.stopPropagation(); if (p.image) setLightboxIdx(i); }}>
          {p.image ? (
            <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-2xl">{getEmoji(p.category)}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-ink text-sm truncate">{p.name}</h3>
            <span className="font-bold text-amber text-sm flex-shrink-0">
              {p.variants.length > 0 ? `${currencySymbol}${Math.min(...p.variants.map(v => v.price))}+` : `${currencySymbol}${p.price}`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {p.category && <span className="text-[10px] bg-cream text-warm-gray px-1.5 py-0.5 rounded-full font-medium">{p.category}</span>}
            {p.stock !== null && <span className="text-[10px] text-warm-gray">{p.stock} in stock</span>}
            {p.variants.length > 0 && <span className="text-[10px] text-amber font-medium">{p.variants.length} variants</span>}
          </div>
          {p.description && (
            <p className="text-warm-gray text-[11px] mt-0.5 truncate">✨ {p.description}</p>
          )}
        </div>

        {/* Edit */}
        <button onClick={(e) => { e.stopPropagation(); openDrawerEdit(i); }}
          className="w-8 h-8 rounded-lg bg-cream flex items-center justify-center text-warm-gray hover:text-amber hover:bg-amber/10 transition-colors flex-shrink-0">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
      </div>

      {/* Delete (revealed by swipe) */}
      <button
        className={`absolute right-0 top-0 bottom-0 w-20 bg-rose text-white flex flex-col items-center justify-center transition-opacity ${swipedIdx === i ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => removeProduct(i)}>
        <span className="text-lg">🗑️</span>
        <span className="text-[10px] font-semibold mt-0.5">Delete</span>
      </button>
    </div>
  );

  // ─── Hidden inputs ────────────────────────────────────────────────────────
  const hiddenInputs = (
    <>
      <input ref={bulkFileRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBulkPhoto(f); }} />
      <input ref={drawerPhotoRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDrawerPhoto(f); if (drawerPhotoRef.current) drawerPhotoRef.current.value = ''; }} />
    </>
  );

  return (
    <main className="min-h-screen bg-cream">
      {/* Progress bar */}
      <div className={`mx-auto px-4 pt-6 ${step === 'products' ? 'max-w-5xl' : 'max-w-xl'}`}>
        <div className="mb-6">
          <div className="w-full bg-white rounded-full h-2">
            <div className="bg-amber h-2 rounded-full transition-all duration-500" style={{ width: progress }} />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-warm-gray font-medium">
            <span className={step === 'setup' ? 'text-amber font-bold' : ''}>{t('step.setup', language)}</span>
            <span className={step === 'products' ? 'text-amber font-bold' : ''}>{t('step.products', language)}</span>
            <span className={step === 'import' ? 'text-amber font-bold' : ''}>{t('step.review', language)}</span>
            <span className={step === 'channels' ? 'text-amber font-bold' : ''}>{t('step.channels', language)}</span>
            <span className={step === 'preview' ? 'text-amber font-bold' : ''}>{t('step.preview', language)}</span>
            <span className={step === 'live' ? 'text-amber font-bold' : ''}>{t('step.live', language)}</span>
          </div>
        </div>
      </div>

      {/* ═══ STEP 1: SETUP ═══ */}
      {step === 'setup' && (
        <div className="max-w-xl mx-auto px-4 pb-6">
          <div className="bg-white rounded-2xl p-6 border border-border">
            <h1 className="font-display text-2xl text-ink mb-1">{t('setup.title', language)}</h1>
            <p className="text-warm-gray text-sm mb-5">{t('setup.subtitle', language)}</p>
            <div className="mb-5">
              <label className="text-xs font-semibold text-warm-gray uppercase tracking-wider mb-2 block">{t('setup.language', language)}</label>
              <div className="flex gap-2">
                {[{ c: 'en', l: 'English' }, { c: 'hi', l: 'Hindi' }, { c: 'es', l: 'Español' }].map(l => (
                  <button key={l.c} onClick={() => setLanguage(l.c)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${language === l.c ? 'bg-amber text-white' : 'bg-cream text-ink hover:bg-amber/10'}`}>
                    {l.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-5">
              <label className="text-xs font-semibold text-warm-gray uppercase tracking-wider mb-2 block">{t('setup.whatSell', language)} <span className="normal-case font-normal text-warm-gray">({t('setup.pickAll', language)})</span></label>
              <div className="grid grid-cols-4 gap-1.5">
                {BUSINESS_TYPES.map(bt => {
                  if (bt.label === 'Other') return (
                    <button key="other" onClick={() => {
                      if (customType.trim()) {
                        setBusinessTypes(prev => prev.includes(customType.trim()) ? prev : [...prev, customType.trim()]);
                      }
                    }}
                      className={`py-2 px-1 rounded-lg text-center transition-all bg-cream hover:bg-amber/5`}>
                      <span className="text-xl block">{bt.icon}</span>
                      <span className="text-[10px] text-ink leading-tight block mt-0.5">Other</span>
                    </button>
                  );
                  const selected = businessTypes.includes(bt.label);
                  return (
                    <button key={bt.label} onClick={() => setBusinessTypes(prev =>
                      selected ? prev.filter(x => x !== bt.label) : [...prev, bt.label]
                    )}
                      className={`py-2 px-1 rounded-lg text-center transition-all ${selected ? 'bg-amber/15 ring-2 ring-amber' : 'bg-cream hover:bg-amber/5'}`}>
                      <span className="text-xl block">{bt.icon}</span>
                      <span className="text-[10px] text-ink leading-tight block mt-0.5">{bt.label}</span>
                    </button>
                  );
                })}
              </div>
              {businessTypes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {businessTypes.map(bt => (
                    <span key={bt} className="flex items-center gap-1 bg-amber/10 text-ink text-xs px-2.5 py-1.5 rounded-full font-medium">
                      {bt}
                      <button onClick={() => setBusinessTypes(prev => prev.filter(x => x !== bt))}
                        className="text-warm-gray hover:text-rose text-[10px] ml-0.5">✕</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <input type="text" value={customType} onChange={(e) => setCustomType(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customType.trim()) {
                      e.preventDefault();
                      setBusinessTypes(prev => prev.includes(customType.trim()) ? prev : [...prev, customType.trim()]);
                      setCustomType('');
                    }
                  }}
                  className="flex-1 px-3 py-2.5 border border-border rounded-xl text-ink text-sm focus:outline-none focus:border-amber" placeholder="Or type something else..." />
                <MicButton onTranscript={(t) => {
                  if (t.trim()) setBusinessTypes(prev => prev.includes(t.trim()) ? prev : [...prev, t.trim()]);
                }} lang={language} small />
              </div>
            </div>
            <div className="mb-6">
              <label className="text-xs font-semibold text-warm-gray uppercase tracking-wider mb-2 block">{t('setup.city', language)}</label>
              <div className="flex gap-2">
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
                  className="flex-1 px-3 py-2.5 border border-border rounded-xl text-ink text-sm focus:outline-none focus:border-amber" placeholder={t('setup.cityPlaceholder', language)} />
                <MicButton onTranscript={(t) => setCity(t)} lang={language} small />
              </div>
              {city && <p className="text-xs text-green mt-1 flex items-center gap-1"><span>✓</span> {city}</p>}
            </div>
            <button onClick={saveSetup} disabled={saving || businessTypes.length === 0 || !city.trim()}
              className="w-full py-4 bg-amber text-white rounded-2xl font-semibold text-lg hover:bg-amber/90 disabled:opacity-40 transition-colors min-h-[52px]">
              {saving ? t('setup.saving', language) : t('setup.next', language)}
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 2: PRODUCTS — SPLIT LAYOUT ═══ */}
      {step === 'products' && (
        <div className="max-w-5xl mx-auto px-4 pb-6">
          {hiddenInputs}

          {/* ── DESKTOP: Side by side ────────────────────────────────── */}
          <div className="hidden md:flex gap-4" style={{ height: 'calc(100vh - 140px)' }}>
            {/* LEFT PANEL — Add buttons (fixed, no scroll) */}
            <div className="w-52 flex-shrink-0 space-y-3">
              <h2 className="font-display text-lg text-ink px-1">{t('products.title', language)}</h2>

              <button onClick={() => bulkFileRef.current?.click()}
                className="w-full bg-white rounded-xl border-2 border-border p-4 text-center hover:border-amber hover:shadow-md transition-all active:scale-95 group">
                <div className="w-10 h-10 bg-amber/10 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:bg-amber/20">
                  <span className="text-xl">📷</span>
                </div>
                <span className="text-xs font-bold text-ink block">{t('products.photo', language)}</span>
                <span className="text-[10px] text-warm-gray block">AI reads all items</span>
              </button>

              <button onClick={recording ? stopRecording : startRecording}
                className={`w-full rounded-xl border-2 p-4 text-center hover:shadow-md transition-all active:scale-95 group ${recording ? 'bg-rose/5 border-rose' : 'bg-white border-border hover:border-amber'}`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2 ${recording ? 'bg-rose/20 animate-pulse' : 'bg-amber/10 group-hover:bg-amber/20'}`}>
                  <span className="text-xl">{recording ? '⏹️' : '🎤'}</span>
                </div>
                <span className="text-xs font-bold text-ink block">{recording ? 'Stop' : t('products.voice', language)}</span>
                <span className="text-[10px] text-warm-gray block">{recording ? 'Tap to finish' : 'Say items & prices'}</span>
              </button>

              <button onClick={openDrawerAdd}
                className="w-full bg-white rounded-xl border-2 border-border p-4 text-center hover:border-amber hover:shadow-md transition-all active:scale-95 group">
                <div className="w-10 h-10 bg-amber/10 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:bg-amber/20">
                  <span className="text-xl">✏️</span>
                </div>
                <span className="text-xs font-bold text-ink block">{t('products.type', language)}</span>
                <span className="text-[10px] text-warm-gray block">Type it in</span>
              </button>

              <button onClick={() => {
                  setCatalogOpen(true); setCatalogFilter(null); setCatalogSelected(new Set()); setCatalogPhotos({}); catalogPhotosFetched.current = new Set();
                  // If no pre-built categories match, generate AI catalog
                  if (!hasMappedCategories && aiCatalogProducts.length === 0) generateAiCatalog();
                }}
                  className="w-full bg-gradient-to-br from-amber/5 to-amber/15 rounded-xl border-2 border-amber/30 p-4 text-center hover:border-amber hover:shadow-md transition-all active:scale-95 group">
                  <div className="w-10 h-10 bg-amber/20 rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:bg-amber/30">
                    <span className="text-xl">🛍️</span>
                  </div>
                  <span className="text-xs font-bold text-amber block">{t('products.catalog', language)}</span>
                  <span className="text-[10px] text-warm-gray block">{hasMappedCategories ? 'Pre-built products' : 'AI generates for you'}</span>
                </button>

              <div className="pt-2">{settingsStrip}</div>
            </div>

            {/* RIGHT PANEL — Product list (scrolls) */}
            <div className="flex-1 bg-white rounded-xl border border-border overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-cream/30">
                <h2 className="font-display text-lg text-ink">My Products</h2>
                <span className="text-xs text-warm-gray font-medium bg-cream px-2.5 py-1 rounded-full">
                  {products.length} item{products.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {products.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <div className="text-6xl mb-4">🛍️</div>
                    <h3 className="font-display text-xl text-ink mb-1">Your shop is empty</h3>
                    <p className="text-warm-gray text-sm max-w-xs mb-4">Add your first product using the buttons on the left</p>
                    {(relevantCategories.length > 0 || !hasMappedCategories) && (
                      <button onClick={() => { setCatalogOpen(true); setCatalogFilter(null); setCatalogSelected(new Set()); setCatalogPhotos({}); catalogPhotosFetched.current = new Set(); if (!hasMappedCategories && aiCatalogProducts.length === 0) generateAiCatalog(); }}
                        className="px-5 py-2.5 bg-amber/10 text-amber rounded-xl text-sm font-semibold hover:bg-amber/20 transition-colors">
                        🛍️ Quick start — pick from catalog
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {products.map((p, i) => productRow(p, i))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── MOBILE: Full width list ──────────────────────────────── */}
          <div className="md:hidden pb-36">
            {/* Settings on mobile */}
            <div className="mb-3">{settingsStrip}</div>

            {/* Product list */}
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-cream/30">
                <h2 className="font-display text-lg text-ink">My Products</h2>
                <span className="text-xs text-warm-gray font-medium bg-cream px-2.5 py-1 rounded-full">
                  {products.length} item{products.length !== 1 ? 's' : ''}
                </span>
              </div>
              {products.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="text-5xl mb-3">🛍️</div>
                  <h3 className="font-display text-lg text-ink mb-1">Add your first product</h3>
                  <p className="text-warm-gray text-sm mb-3">Tap the button below to get started</p>
                  <button onClick={() => { setCatalogOpen(true); setCatalogFilter(null); setCatalogSelected(new Set()); setCatalogPhotos({}); catalogPhotosFetched.current = new Set(); if (!hasMappedCategories && aiCatalogProducts.length === 0) generateAiCatalog(); }}
                    className="px-4 py-2 bg-amber/10 text-amber rounded-lg text-sm font-semibold hover:bg-amber/20 transition-colors">
                    🛍️ Pick from catalog
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {products.map((p, i) => productRow(p, i))}
                </div>
              )}
            </div>
          </div>

          {/* ── MOBILE: Fixed bottom buttons ─────────────────────── */}
          <div className="md:hidden fixed bottom-[60px] left-0 right-0 px-4 pb-3 z-30 flex gap-2">
            <button onClick={() => { setCatalogOpen(true); setCatalogFilter(null); setCatalogSelected(new Set()); setCatalogPhotos({}); catalogPhotosFetched.current = new Set(); if (!hasMappedCategories && aiCatalogProducts.length === 0) generateAiCatalog(); }}
              className="py-3.5 px-4 bg-white border-2 border-amber text-amber rounded-xl font-bold text-sm shadow-lg active:scale-[0.98] transition-all">
              🛍️ Catalog
            </button>
            <button onClick={openDrawerAdd}
              className="flex-1 py-3.5 bg-amber text-white rounded-xl font-bold text-base shadow-lg shadow-amber/30 hover:bg-amber/90 active:scale-[0.98] transition-all">
              + Add Product
            </button>
          </div>

          {/* ── DRAWER (slides up from bottom) ───────────────────────── */}
          {/* Backdrop */}
          <div className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={closeDrawer} />
          {/* Drawer panel */}
          <div className={`fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-300 ease-out ${drawerOpen ? 'translate-y-0' : 'translate-y-full'}`}>
            <div className="bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-border rounded-full" />
              </div>

              <div className="px-5 pb-6 space-y-4">
                <h3 className="font-display text-lg text-ink">
                  {drawerEditIdx !== null ? 'Edit Product' : 'New Product'}
                </h3>

                {/* Name + mic */}
                <div>
                  <label className="text-[10px] text-warm-gray uppercase tracking-wider font-semibold mb-1 block">Product Name</label>
                  <div className="flex gap-2">
                    <input ref={dNameRef} type="text" value={dName}
                      onChange={(e) => { setDName(e.target.value); triggerDrawerSuggest(e.target.value); }}
                      className="flex-1 px-3 py-3 border border-border rounded-xl text-ink text-sm focus:outline-none focus:ring-2 focus:ring-amber/30 focus:border-amber"
                      placeholder="e.g., Blackforest Cake" />
                    <MicButton onTranscript={(t) => { setDName(t); triggerDrawerSuggest(t, true); }} lang={language} small />
                  </div>
                </div>

                {/* Price + Category */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-warm-gray uppercase tracking-wider font-semibold mb-1 block">Price</label>
                    {dVariants.length > 0 ? (
                      <div className="px-3 py-3 bg-cream rounded-xl text-warm-gray text-xs">Price set per variant</div>
                    ) : (
                      <input type="number" value={dPrice} onChange={(e) => setDPrice(e.target.value)}
                        className="w-full px-3 py-3 border border-border rounded-xl text-ink text-sm focus:outline-none focus:border-amber" placeholder="0.00" step="0.01" />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-warm-gray uppercase tracking-wider font-semibold mb-1 block">Category</label>
                    <select value={dCategory} onChange={(e) => setDCategory(e.target.value)}
                      className="w-full px-3 py-3 border border-border rounded-xl text-ink text-sm bg-white focus:outline-none focus:border-amber">
                      <option value="">Select</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                {/* Quantity */}
                <div>
                  <label className="text-[10px] text-warm-gray uppercase tracking-wider font-semibold mb-1 block">Quantity in stock</label>
                  <input type="number" value={dQty} onChange={(e) => setDQty(e.target.value)}
                    className="w-full px-3 py-3 border border-border rounded-xl text-ink text-sm focus:outline-none focus:border-amber" placeholder="Leave empty for unlimited" min="0" />
                </div>

                {/* Variants */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] text-warm-gray uppercase tracking-wider font-semibold">Variants <span className="normal-case font-normal">(optional)</span></label>
                    <button onClick={() => setDVariants(prev => [...prev, { label: '', price: 0, qty: null }])}
                      className="text-amber text-xs font-semibold hover:underline">+ Add</button>
                  </div>
                  {dVariants.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {dVariants.map((v, vi) => (
                        <div key={vi} className="flex items-center gap-2">
                          <input type="text" value={v.label}
                            onChange={(e) => { const nv = [...dVariants]; nv[vi] = { ...v, label: e.target.value }; setDVariants(nv); }}
                            className="flex-1 px-2.5 py-2 border border-border rounded-lg text-ink text-xs focus:outline-none focus:border-amber"
                            placeholder="Size/weight" />
                          <input type="number" value={v.price || ''}
                            onChange={(e) => { const nv = [...dVariants]; nv[vi] = { ...v, price: parseFloat(e.target.value) || 0 }; setDVariants(nv); }}
                            className="w-20 px-2.5 py-2 border border-border rounded-lg text-ink text-xs focus:outline-none focus:border-amber"
                            placeholder="Price" step="0.01" />
                          <input type="number" value={v.qty ?? ''}
                            onChange={(e) => { const nv = [...dVariants]; nv[vi] = { ...v, qty: e.target.value ? parseInt(e.target.value) : null }; setDVariants(nv); }}
                            className="w-14 px-2 py-2 border border-border rounded-lg text-ink text-xs focus:outline-none focus:border-amber"
                            placeholder="Qty" />
                          <button onClick={() => setDVariants(prev => prev.filter((_, j) => j !== vi))}
                            className="text-warm-gray hover:text-rose text-sm flex-shrink-0">🗑️</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Quick suggestions */}
                  <div className="flex flex-wrap gap-1.5">
                    {VARIANT_SUGGESTIONS.map(s => (
                      <button key={s} onClick={() => setDVariants(prev => [...prev, { label: s, price: 0, qty: null }])}
                        className="text-[10px] px-2 py-1 bg-cream text-warm-gray rounded-full hover:bg-amber/10 hover:text-ink transition-colors font-medium">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description (editable) */}
                <div>
                  <label className="text-[10px] text-warm-gray uppercase tracking-wider font-semibold mb-1 block">
                    Description {dAiSuggesting && <span className="text-amber animate-pulse normal-case">✨ AI writing...</span>}
                  </label>
                  <textarea value={dDesc} onChange={(e) => setDDesc(e.target.value)}
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-ink text-sm focus:outline-none focus:border-amber resize-none leading-relaxed"
                    rows={2} placeholder="AI auto-fills when you type a name — or write your own" />
                </div>

                {/* Ingredients (food only) */}
                {isFoodBusiness && (
                  <div>
                    <label className="text-[10px] text-warm-gray uppercase tracking-wider font-semibold mb-1 block">
                      Ingredients {dAiSuggesting && <span className="text-amber animate-pulse normal-case">✨ AI adding...</span>}
                    </label>
                    {dIngredients.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {dIngredients.map((ing, ii) => (
                          <span key={ii} className="flex items-center gap-1 bg-cream text-ink text-xs px-2.5 py-1.5 rounded-full font-medium">
                            {ing}
                            <button onClick={() => setDIngredients(prev => prev.filter((_, j) => j !== ii))}
                              className="text-warm-gray hover:text-rose ml-0.5 text-[10px]">✕</button>
                          </span>
                        ))}
                      </div>
                    )}
                    <input type="text" placeholder="Type ingredient + press Enter"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) { setDIngredients(prev => [...prev, val]); (e.target as HTMLInputElement).value = ''; }
                        }
                      }}
                      className="w-full px-3 py-2 border border-border rounded-xl text-ink text-xs focus:outline-none focus:border-amber" />
                  </div>
                )}

                {/* Photo */}
                <div>
                  <label className="text-[10px] text-warm-gray uppercase tracking-wider font-semibold mb-1 block">
                    Photo {dGeneratingImage && <span className="text-amber animate-pulse normal-case">generating...</span>}
                    {dSearchingPhotos && <span className="text-amber animate-pulse normal-case">searching...</span>}
                  </label>
                  {dImage ? (
                    <div className="relative w-24 h-24 rounded-xl overflow-hidden">
                      <img src={dImage} alt="Product" className="w-full h-full object-cover" />
                      <button onClick={() => { setDImage(null); dImageRef.current = null; }}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/50 rounded-full text-white text-[10px] flex items-center justify-center">✕</button>
                    </div>
                  ) : dGeneratingImage ? (
                    <div className="w-24 h-24 rounded-xl bg-cream flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-amber border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <button onClick={() => drawerPhotoRef.current?.click()}
                          className="flex-1 py-3 border-2 border-dashed border-border rounded-xl text-warm-gray text-sm hover:border-amber hover:text-ink transition-colors">
                          Upload Photo
                        </button>
                        {dName.trim().length >= 3 && (
                          <button onClick={() => searchPexelsPhotos(dName.trim())} disabled={dSearchingPhotos}
                            className="px-4 py-3 bg-amber/10 text-amber text-sm rounded-xl hover:bg-amber/20 transition-colors border border-amber/30 whitespace-nowrap font-medium disabled:opacity-50">
                            Find Photo
                          </button>
                        )}
                      </div>
                      {/* Pexels photo options */}
                      {dPexelsPhotos.length > 0 && (
                        <div>
                          <p className="text-[10px] text-warm-gray mb-1.5">Pick a photo:</p>
                          <div className="flex gap-2">
                            {dPexelsPhotos.map((photo) => (
                              <button key={photo.id} onClick={() => { setDImage(photo.src); dImageRef.current = photo.src; setDPexelsPhotos([]); }}
                                className="w-16 h-16 rounded-lg overflow-hidden border-2 border-border hover:border-amber transition-colors flex-shrink-0">
                                <img src={photo.thumb || photo.src} alt="Option" className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* DALL-E fallback */}
                      {dName.trim().length >= 3 && dPexelsPhotos.length === 0 && !dSearchingPhotos && (
                        <button onClick={() => generateImage(dName.trim(), dCategory || businessType)}
                          className="text-[10px] text-warm-gray hover:text-ink transition-colors">
                          Or generate with AI (slower)
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Save */}
                <button onClick={saveDrawer} disabled={!dName.trim()}
                  className="w-full py-4 bg-amber text-white rounded-xl font-bold text-base hover:bg-amber/90 disabled:opacity-30 transition-all min-h-[52px] active:scale-[0.98]">
                  {drawerEditIdx !== null ? 'Save Changes' : 'Save Product'}
                </button>
              </div>
            </div>
          </div>

          {/* ── LIGHTBOX ─────────────────────────────────────────────── */}
          {lightboxIdx !== null && products[lightboxIdx]?.image && (
            <div className="fixed inset-0 bg-black z-[60] flex items-center justify-center"
              onTouchStart={(e) => { lightboxTouchY.current = e.touches[0].clientY; }}
              onTouchEnd={(e) => { if (e.changedTouches[0].clientY - lightboxTouchY.current > 100) setLightboxIdx(null); }}
              onClick={() => setLightboxIdx(null)}>
              <button className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/20 rounded-full text-white text-lg flex items-center justify-center backdrop-blur-sm"
                onClick={() => setLightboxIdx(null)}>✕</button>
              <img src={products[lightboxIdx].image!} alt={products[lightboxIdx].name}
                className="max-w-[90vw] max-h-[90vh] object-contain"
                style={{ touchAction: 'pinch-zoom' }}
                onClick={(e) => e.stopPropagation()} />
            </div>
          )}

          {/* ── Recording overlay ────────────────────────────────────── */}
          {recording && (
            <div className="fixed inset-0 bg-ink/70 z-50 flex items-center justify-center backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-8 text-center mx-6 max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="w-24 h-24 bg-rose rounded-full flex items-center justify-center mx-auto mb-5 animate-pulse shadow-lg shadow-rose/30">
                  <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                    <line x1="12" x2="12" y1="19" y2="22"/>
                  </svg>
                </div>
                <h3 className="font-display text-2xl text-ink mb-2">Listening...</h3>
                <p className="text-warm-gray text-sm mb-2">Say your products with prices</p>
                <p className="text-[11px] text-warm-gray/50 mb-6 italic">
                  &quot;Namkeen 50 rupees, Chakli 80 rupees, Mathri 60&quot;
                </p>
                <button onClick={stopRecording}
                  className="py-3.5 px-10 bg-rose text-white rounded-full font-bold text-sm shadow-lg shadow-rose/30 hover:bg-rose/90 transition-all active:scale-95">
                  ⏹ Stop Recording
                </button>
              </div>
            </div>
          )}

          {/* ── Extracting overlay ───────────────────────────────────── */}
          {extracting && (
            <div className="fixed inset-0 bg-ink/50 z-50 flex items-center justify-center backdrop-blur-sm">
              <div className="bg-white rounded-3xl p-8 text-center mx-6 max-w-xs w-full shadow-2xl">
                <div className="w-14 h-14 border-[3px] border-amber border-t-transparent rounded-full animate-spin mx-auto mb-5" />
                <h3 className="font-display text-xl text-ink mb-1">AI is reading your menu...</h3>
                <p className="text-warm-gray text-sm">This takes a few seconds</p>
              </div>
            </div>
          )}

          {/* ── Review overlay ───────────────────────────────────────── */}
          {showReview && reviewProducts.length > 0 && (
            <div className="fixed inset-0 bg-ink/50 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm">
              <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
                <div className="p-5 border-b border-border flex items-center justify-between flex-shrink-0">
                  <div>
                    <h2 className="font-display text-xl text-ink">
                      AI found {reviewProducts.length} product{reviewProducts.length !== 1 ? 's' : ''}
                    </h2>
                    <p className="text-warm-gray text-xs mt-0.5">Toggle items and edit inline</p>
                  </div>
                  <button onClick={() => { setShowReview(false); setReviewProducts([]); }}
                    className="w-8 h-8 rounded-full bg-cream flex items-center justify-center text-warm-gray hover:text-ink">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {reviewProducts.map((p, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3.5 rounded-xl border-2 transition-all ${p.selected ? 'border-amber/50 bg-amber/5' : 'border-border opacity-40'}`}>
                      <button
                        onClick={() => { const np = [...reviewProducts]; np[i] = { ...p, selected: !p.selected }; setReviewProducts(np); }}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${p.selected ? 'bg-amber border-amber text-white' : 'border-border'}`}>
                        {p.selected && <span className="text-[10px] font-bold">✓</span>}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <input value={p.name}
                            onChange={(e) => { const np = [...reviewProducts]; np[i] = { ...p, name: e.target.value }; setReviewProducts(np); }}
                            className="flex-1 font-bold text-ink text-sm bg-transparent border-b border-transparent focus:border-amber focus:outline-none min-w-0" />
                          <div className="flex items-center flex-shrink-0 gap-0.5">
                            <span className="text-xs text-warm-gray">{currencySymbol}</span>
                            <input type="number" value={p.price}
                              onChange={(e) => { const np = [...reviewProducts]; np[i] = { ...p, price: parseFloat(e.target.value) || 0 }; setReviewProducts(np); }}
                              className="w-14 text-right font-bold text-ink text-sm bg-transparent border-b border-transparent focus:border-amber focus:outline-none" step="0.01" />
                          </div>
                        </div>
                        {p.description && <p className="text-warm-gray text-[11px] mt-1 leading-snug">{p.description}</p>}
                        {p.category && <span className="inline-block bg-cream text-warm-gray text-[9px] px-2 py-0.5 rounded-full mt-1.5 font-medium">{p.category}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t border-border flex-shrink-0">
                  <button onClick={confirmReview}
                    disabled={reviewProducts.filter(p => p.selected).length === 0}
                    className="w-full py-4 bg-amber text-white rounded-xl font-bold text-base hover:bg-amber/90 disabled:opacity-30 transition-all min-h-[52px]">
                    Add {reviewProducts.filter(p => p.selected).length} product{reviewProducts.filter(p => p.selected).length !== 1 ? 's' : ''} to shop
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Catalog picker overlay ─────────────────────────────── */}
          {catalogOpen && (
            <div className="fixed inset-0 bg-ink/50 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm">
              <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-5 border-b border-border flex items-center justify-between flex-shrink-0">
                  <div>
                    <h2 className="font-display text-xl text-ink">Pick from Catalog</h2>
                    <p className="text-warm-gray text-xs mt-0.5">
                      {catalogSelected.size > 0
                        ? `${catalogSelected.size} selected`
                        : 'Tap products to add to your shop'}
                    </p>
                  </div>
                  <button onClick={() => { setCatalogOpen(false); setCatalogSelected(new Set()); setCatalogFilter(null); }}
                    className="w-8 h-8 rounded-full bg-cream flex items-center justify-center text-warm-gray hover:text-ink">✕</button>
                </div>

                {/* Category pills */}
                <div className="px-4 py-3 border-b border-border flex-shrink-0 overflow-x-auto">
                  <div className="flex gap-2 min-w-max">
                    <button onClick={() => setCatalogFilter(null)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                        !catalogFilter ? 'bg-amber text-white' : 'bg-cream text-warm-gray hover:bg-amber/10'
                      }`}>
                      All
                    </button>
                    {relevantCategories.map(cat => (
                      <button key={cat.id} onClick={() => setCatalogFilter(cat.name)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                          catalogFilter === cat.name ? 'bg-amber text-white' : 'bg-cream text-warm-gray hover:bg-amber/10'
                        }`}>
                        {cat.emoji} {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product grid */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {filteredCatalogProducts.map((cp) => {
                      const isSelected = catalogSelected.has(cp.name);
                      const alreadyAdded = products.some(p => p.name === cp.name);
                      const cat = dbCategories.find(c => c.name === cp.parentCategory);
                      return (
                        <button key={cp.name}
                          disabled={alreadyAdded}
                          onClick={() => {
                            setCatalogSelected(prev => {
                              const next = new Set(prev);
                              if (next.has(cp.name)) next.delete(cp.name);
                              else next.add(cp.name);
                              return next;
                            });
                          }}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            alreadyAdded
                              ? 'border-border bg-cream/50 opacity-50 cursor-not-allowed'
                              : isSelected
                                ? 'border-amber bg-amber/5 shadow-sm'
                                : 'border-border hover:border-amber/40 bg-white'
                          }`}>
                          {/* Product photo or emoji */}
                          <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-2 bg-cream">
                            {catalogPhotos[cp.name] ? (
                              <img src={catalogPhotos[cp.name]} alt={cp.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <span className="text-3xl">{cat?.emoji || '🛍️'}</span>
                              </div>
                            )}
                            {isSelected && (
                              <span className="absolute top-1.5 right-1.5 w-6 h-6 bg-amber rounded-full flex items-center justify-center shadow-md">
                                <span className="text-white text-[10px] font-bold">✓</span>
                              </span>
                            )}
                            {alreadyAdded && (
                              <span className="absolute top-1.5 right-1.5 bg-white/80 text-[9px] text-warm-gray font-medium px-1.5 py-0.5 rounded-full">Added</span>
                            )}
                          </div>
                          <p className="font-semibold text-ink text-sm leading-tight">{cp.name}</p>
                          <p className="text-[10px] text-warm-gray mt-0.5 line-clamp-2">{cp.description}</p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-xs font-bold text-amber">{currencySymbol}{cp.priceMin}</span>
                            {cp.priceMax > cp.priceMin && (
                              <span className="text-[10px] text-warm-gray">– {currencySymbol}{cp.priceMax}</span>
                            )}
                          </div>
                          {cp.variants.length > 0 && (
                            <p className="text-[9px] text-warm-gray mt-1">{cp.variants.slice(0, 3).join(', ')}{cp.variants.length > 3 ? '...' : ''}</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {generatingCatalog && (
                    <div className="text-center py-12">
                      <div className="w-10 h-10 border-3 border-amber/30 border-t-amber rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-warm-gray text-sm">Creating catalog for your business...</p>
                      <p className="text-warm-gray text-xs mt-1">Finding photos too</p>
                    </div>
                  )}
                  {!generatingCatalog && filteredCatalogProducts.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-warm-gray text-sm">No products in this category</p>
                    </div>
                  )}
                </div>

                {/* Bottom bar */}
                <div className="p-4 border-t border-border flex-shrink-0">
                  <button onClick={addCatalogProducts}
                    disabled={catalogSelected.size === 0}
                    className="w-full py-4 bg-amber text-white rounded-xl font-bold text-base hover:bg-amber/90 disabled:opacity-30 transition-all min-h-[52px]">
                    Add {catalogSelected.size} product{catalogSelected.size !== 1 ? 's' : ''} to shop
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Sticky Done bar ──────────────────────────────────────── */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border px-4 py-3 z-30">
            <div className="max-w-5xl mx-auto flex gap-3">
              <button onClick={() => setStep('setup')} className="px-4 py-3 text-warm-gray text-sm font-medium hover:text-ink">Back</button>
              <button onClick={saveEverything} disabled={saving || products.length === 0}
                className={`flex-1 py-3 rounded-xl font-semibold text-base transition-all min-h-[48px] ${
                  products.length > 0 ? 'bg-amber text-white hover:bg-amber/90 active:scale-[0.98] shadow-sm' : 'bg-cream text-warm-gray'
                }`}>
                {saving ? 'Saving...' : products.length === 0 ? 'Add products above' : `Done — Save ${products.length} product${products.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: IMPORT DATA ═══ */}
      {step === 'import' && (
        <div className="max-w-xl mx-auto px-4 pb-6">
          <div className="text-center mb-5">
            <h1 className="font-display text-2xl text-ink mb-1">Import Your Existing Data</h1>
            <p className="text-warm-gray text-sm">Both optional — skip if starting fresh</p>
          </div>

          {/* ── CARD 1: INVENTORY ──────────────────────────── */}
          <div className="bg-white rounded-2xl p-5 border border-border mb-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">📦</span>
              <div>
                <h2 className="font-display text-lg text-ink">Product Inventory</h2>
                <p className="text-xs text-warm-gray">Already tracking stock in Excel or Google Sheets? Import it — all products added in one go</p>
              </div>
            </div>

            <div className="flex gap-2.5 mb-3">
              <button onClick={() => inventoryFileRef.current?.click()} disabled={importingInventory}
                className="flex-1 py-3.5 border-2 border-dashed border-border rounded-xl text-sm text-warm-gray hover:border-amber hover:text-ink transition-all disabled:opacity-50 font-medium">
                {importingInventory ? 'Reading...' : '📄 Upload Excel / CSV'}
              </button>
              <button onClick={() => alert('Google Sheets integration coming soon!')}
                className="flex-1 py-3.5 border-2 border-dashed border-border rounded-xl text-sm text-warm-gray hover:border-amber hover:text-ink transition-all font-medium">
                🔗 Google Sheets
              </button>
            </div>
            <input ref={inventoryFileRef} type="file" accept=".csv,.xlsx,.xls,.tsv" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleInventoryFile(e.target.files[0]); }} />

            <div className="flex gap-4 text-[11px] text-warm-gray">
              <span className="flex items-center gap-1.5"><span className="text-green">✓</span> AI maps your columns auto</span>
              <span className="flex items-center gap-1.5"><span className="text-green">✓</span> All products imported at once</span>
            </div>

            {/* Preview table */}
            {showImportPreview && importedProducts.length > 0 && (
              <div className="mt-4 animate-in slide-in-from-bottom-2">
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-cream text-warm-gray">
                        <th className="text-left px-3 py-2 font-semibold">Name</th>
                        <th className="text-left px-3 py-2 font-semibold">Price</th>
                        <th className="text-left px-3 py-2 font-semibold">Qty</th>
                        <th className="text-left px-3 py-2 font-semibold">Cat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importedProducts.slice(0, 8).map((p, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-3 py-2 text-ink font-medium">{p.name}</td>
                          <td className="px-3 py-2 text-ink">{currencySymbol}{p.price}</td>
                          <td className="px-3 py-2 text-ink">{p.stock ?? '—'}</td>
                          <td className="px-3 py-2 text-warm-gray">{p.category || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importedProducts.length > 8 && (
                    <p className="text-[10px] text-warm-gray text-center py-1.5 bg-cream">...and {importedProducts.length - 8} more</p>
                  )}
                </div>
                <p className="text-sm text-ink font-medium mt-3 text-center">
                  Found {importedProducts.length} products — looks right?
                </p>
                <div className="flex gap-2 mt-2">
                  <button onClick={confirmImportProducts}
                    className="flex-1 py-3 bg-amber text-white rounded-xl font-semibold text-sm hover:bg-amber/90 transition-colors">
                    Import All
                  </button>
                  <button onClick={() => setStep('products')}
                    className="flex-1 py-3 border border-border rounded-xl text-ink text-sm font-medium hover:bg-cream transition-colors">
                    Edit first
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── CARD 2: CUSTOMERS ─────────────────────────── */}
          <div className="bg-white rounded-2xl p-5 border border-border mb-5">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">👥</span>
              <div>
                <h2 className="font-display text-lg text-ink">Customer List</h2>
                <p className="text-xs text-warm-gray">Import your existing customers so AI knows their preferences and replies personally from Day 1</p>
              </div>
            </div>

            <div className="space-y-2 mb-3">
              <button onClick={() => customerFileRef.current?.click()} disabled={importingCustomers}
                className="w-full py-3.5 border-2 border-dashed border-border rounded-xl text-sm text-warm-gray hover:border-amber hover:text-ink transition-all disabled:opacity-50 font-medium">
                {importingCustomers ? 'Reading...' : '📄 Upload Excel / CSV'}
              </button>
              <button onClick={() => { setWaDrawerOpen(true); setExtractedFromChat([]); setWaChatText(''); }}
                className="w-full py-3.5 border-2 border-dashed border-border rounded-xl text-sm text-warm-gray hover:border-amber hover:text-ink transition-all font-medium">
                💬 Paste WhatsApp Chat
              </button>
              <button onClick={() => { setManualDrawerOpen(true); setManualName(''); setManualPhone(''); setManualNotes(''); }}
                className="w-full py-3.5 border-2 border-dashed border-border rounded-xl text-sm text-warm-gray hover:border-amber hover:text-ink transition-all font-medium">
                ✏️ Add One Manually
              </button>
            </div>
            <input ref={customerFileRef} type="file" accept=".csv,.xlsx,.xls,.tsv" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) handleCustomerFile(e.target.files[0]); }} />

            <div className="flex gap-4 text-[11px] text-warm-gray">
              <span className="flex items-center gap-1.5"><span className="text-green">✓</span> AI builds customer profiles</span>
              <span className="flex items-center gap-1.5"><span className="text-green">✓</span> Personalised replies from Day 1</span>
            </div>

            {/* Customer insights card */}
            {showCustomerInsights && importedCustomers.length > 0 && (
              <div className="mt-4 bg-cream rounded-xl p-4 animate-in slide-in-from-bottom-2">
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span>👥</span>
                    <span className="text-ink font-medium">{importedCustomers.length} customers imported</span>
                  </div>
                  {customerInsights.topCustomer && (
                    <div className="flex items-center gap-2">
                      <span>🏆</span>
                      <span className="text-ink">Most loyal: <strong>{customerInsights.topCustomer}</strong> ({customerInsights.topCount}x)</span>
                    </div>
                  )}
                  {(customerInsights.inactive ?? 0) > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>💤</span>
                        <span className="text-ink">{customerInsights.inactive} inactive 30+ days</span>
                      </div>
                      <button className="text-amber text-xs font-semibold hover:underline">Send them a nudge?</button>
                    </div>
                  )}
                  {(customerInsights.birthdays ?? 0) > 0 && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>🎂</span>
                        <span className="text-ink">{customerInsights.birthdays} birthdays this month</span>
                      </div>
                      <button className="text-amber text-xs font-semibold hover:underline">Send birthday offer</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Bottom buttons */}
          <button onClick={() => setStep('channels')}
            className="w-full py-4 bg-amber text-white rounded-2xl font-semibold text-lg hover:bg-amber/90 transition-all min-h-[52px] mb-2">
            {importedProducts.length > 0 || importedCustomers.length > 0 ? 'Done — Next Step' : 'Done — Next Step'}
          </button>
          <button onClick={() => setStep('channels')}
            className="w-full text-warm-gray text-sm hover:text-ink py-2">
            Skip — I&apos;ll do this later
          </button>
          <button onClick={() => setStep('products')} className="w-full text-warm-gray mt-1 text-sm hover:text-ink">Back</button>

          {/* ── WhatsApp Chat Drawer ─────────────────────── */}
          <div className={`fixed inset-0 z-40 transition-opacity duration-300 ${waDrawerOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            <div className={`absolute inset-0 bg-ink/40 backdrop-blur-sm transition-opacity duration-300 ${waDrawerOpen ? 'opacity-100' : 'opacity-0'}`}
              onClick={() => setWaDrawerOpen(false)} />
            <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out z-50 max-h-[85vh] overflow-y-auto ${
              waDrawerOpen ? 'translate-y-0' : 'translate-y-full'
            }`}>
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-border rounded-full" />
              </div>
              <div className="px-5 pb-6 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💬</span>
                  <h3 className="font-display text-lg text-ink">Paste your WhatsApp order chat</h3>
                </div>

                <div className="bg-cream rounded-xl p-3 text-xs text-warm-gray space-y-1">
                  <p className="font-semibold text-ink text-[11px]">How to export:</p>
                  <p>Open WhatsApp chat &rarr; tap ⋮ &rarr; More &rarr; Export Chat &rarr; Without Media</p>
                  <p>Copy the text and paste below</p>
                </div>

                <textarea value={waChatText} onChange={(e) => setWaChatText(e.target.value)}
                  className="w-full px-3 py-3 border border-border rounded-xl text-ink text-sm focus:outline-none focus:border-amber resize-none leading-relaxed"
                  rows={6} placeholder="Paste chat here..." />

                {extractedFromChat.length > 0 ? (
                  <div className="bg-green/5 border border-green/20 rounded-xl p-4 space-y-2">
                    <p className="text-sm font-semibold text-ink">Found {extractedFromChat.length} customers in this chat:</p>
                    {extractedFromChat.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-warm-gray">-</span>
                        <div>
                          <span className="font-medium text-ink">{c.name}</span>
                          {c.notes && <span className="text-warm-gray"> — {c.notes}</span>}
                        </div>
                      </div>
                    ))}
                    <button onClick={confirmChatCustomers}
                      className="w-full py-3 bg-amber text-white rounded-xl font-semibold text-sm mt-2 hover:bg-amber/90 transition-colors">
                      Add These Customers
                    </button>
                  </div>
                ) : (
                  <button onClick={extractWhatsAppChat} disabled={extractingChat || !waChatText.trim()}
                    className="w-full py-4 bg-amber text-white rounded-xl font-bold text-base hover:bg-amber/90 disabled:opacity-30 transition-all min-h-[52px]">
                    {extractingChat ? 'Extracting...' : '🔍 Extract Customers'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Add Manually Drawer ──────────────────────── */}
          <div className={`fixed inset-0 z-40 transition-opacity duration-300 ${manualDrawerOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            <div className={`absolute inset-0 bg-ink/40 backdrop-blur-sm transition-opacity duration-300 ${manualDrawerOpen ? 'opacity-100' : 'opacity-0'}`}
              onClick={() => setManualDrawerOpen(false)} />
            <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out z-50 max-h-[85vh] overflow-y-auto ${
              manualDrawerOpen ? 'translate-y-0' : 'translate-y-full'
            }`}>
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-border rounded-full" />
              </div>
              <div className="px-5 pb-6 space-y-4">
                <h3 className="font-display text-lg text-ink">Add Customer</h3>

                <div>
                  <label className="text-[10px] text-warm-gray uppercase tracking-wider font-semibold mb-1 block">Customer Name</label>
                  <div className="flex gap-2">
                    <input type="text" value={manualName} onChange={(e) => setManualName(e.target.value)}
                      className="flex-1 px-3 py-3 border border-border rounded-xl text-ink text-sm focus:outline-none focus:border-amber"
                      placeholder="e.g. Priya Sharma" />
                    <MicButton onTranscript={(t) => setManualName(t)} lang={language} small />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-warm-gray uppercase tracking-wider font-semibold mb-1 block">Phone / WhatsApp Number</label>
                  <input type="tel" value={manualPhone} onChange={(e) => setManualPhone(e.target.value)}
                    className="w-full px-3 py-3 border border-border rounded-xl text-ink text-sm focus:outline-none focus:border-amber"
                    placeholder="+91" />
                </div>

                <div>
                  <label className="text-[10px] text-warm-gray uppercase tracking-wider font-semibold mb-1 block">Notes <span className="normal-case font-normal">(optional)</span></label>
                  <div className="flex gap-2">
                    <textarea value={manualNotes} onChange={(e) => setManualNotes(e.target.value)}
                      className="flex-1 px-3 py-2.5 border border-border rounded-xl text-ink text-sm focus:outline-none focus:border-amber resize-none"
                      rows={2} placeholder="e.g. Loves chocolate cake, orders every 2 weeks" />
                    <MicButton onTranscript={(t) => setManualNotes(prev => prev ? prev + ' ' + t : t)} lang={language} small />
                  </div>
                </div>

                <button onClick={saveManualCustomer} disabled={!manualName.trim()}
                  className="w-full py-4 bg-amber text-white rounded-xl font-bold text-base hover:bg-amber/90 disabled:opacity-30 transition-all min-h-[52px]">
                  Save Customer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ STEP 4: CHANNELS (3 sub-steps) ═══ */}
      {step === 'channels' && (
        <div className="max-w-xl mx-auto px-4 pb-6">
          {/* Sub-step progress */}
          <div className="flex items-center gap-2 mb-5 px-1">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  channelStep >= s ? 'bg-amber text-white' : 'bg-cream text-warm-gray'
                }`}>{s}</div>
                <span className={`text-xs font-medium hidden sm:block ${channelStep >= s ? 'text-ink' : 'text-warm-gray'}`}>
                  {s === 1 ? t('channels.payment', language) : s === 2 ? t('channels.comm', language) : 'Launch'}
                </span>
                {s < 3 && <div className={`flex-1 h-0.5 ${channelStep > s ? 'bg-amber' : 'bg-border'}`} />}
              </div>
            ))}
          </div>

          {/* ── SUB-STEP 1: Payment ────────────────────────────── */}
          {channelStep === 1 && (
            <div className="bg-white rounded-2xl p-6 border border-border">
              <h1 className="font-display text-2xl text-ink mb-1">How do customers pay you?</h1>
              <p className="text-warm-gray text-sm mb-5">Pick all that apply — you can change later</p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { id: 'upi', icon: '📱', label: 'UPI', sub: 'Scan / ID', show: currency === 'INR' },
                  { id: 'stripe', icon: '💳', label: 'Stripe', sub: 'Cards & online', show: true },
                  { id: 'cash', icon: '💵', label: 'Cash', sub: 'On pickup', show: true },
                  { id: 'zelle', icon: '🟢', label: 'Zelle', sub: 'USA transfers', show: currency !== 'INR' },
                ].filter(p => p.show).map(p => {
                  const selected = selectedPayments.includes(p.id);
                  return (
                    <button key={p.id}
                      onClick={() => setSelectedPayments(prev => selected ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        selected ? 'border-amber bg-amber/5' : 'border-border hover:border-amber/40'
                      }`}>
                      <span className="text-2xl block mb-2">{p.icon}</span>
                      <p className="font-semibold text-ink text-sm">{p.label}</p>
                      <p className="text-[10px] text-warm-gray">{p.sub}</p>
                      {selected && <span className="text-amber text-xs font-bold mt-1 block">Selected</span>}
                    </button>
                  );
                })}
              </div>

              {/* UPI details */}
              {selectedPayments.includes('upi') && (
                <div className="bg-cream rounded-xl p-4 mb-4 space-y-3">
                  <p className="text-xs font-semibold text-ink">UPI Details</p>
                  <input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)}
                    className="w-full px-3 py-3 border border-border rounded-xl text-ink text-sm bg-white focus:outline-none focus:border-amber"
                    placeholder="yourname@upi or phone@paytm" />
                  <div className="flex items-center gap-3">
                    <button onClick={() => upiQrRef.current?.click()}
                      className="px-4 py-2 border border-border rounded-lg text-xs text-warm-gray hover:border-amber hover:text-ink transition-colors bg-white">
                      {upiQr ? 'Change QR' : 'Upload QR Code'}
                    </button>
                    {upiQr && <div className="w-12 h-12 rounded-lg overflow-hidden border border-border"><img src={upiQr} alt="QR" className="w-full h-full object-cover" /></div>}
                    <input ref={upiQrRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleUpiQr(e.target.files[0]); }} />
                  </div>
                </div>
              )}

              {/* Zelle details */}
              {selectedPayments.includes('zelle') && (
                <div className="bg-cream rounded-xl p-4 mb-4">
                  <p className="text-xs font-semibold text-ink mb-2">Zelle Details</p>
                  <input type="text" value={zelleId} onChange={(e) => setZelleId(e.target.value)}
                    className="w-full px-3 py-3 border border-border rounded-xl text-ink text-sm bg-white focus:outline-none focus:border-amber"
                    placeholder="Email or phone linked to Zelle" />
                </div>
              )}

              {/* Stripe notice */}
              {selectedPayments.includes('stripe') && (
                <div className="bg-blue/5 border border-blue/20 rounded-xl p-4 mb-4">
                  <p className="text-xs text-ink font-medium">Stripe will be connected after onboarding</p>
                  <p className="text-[10px] text-warm-gray mt-0.5">You&apos;ll get a link to set up card payments</p>
                </div>
              )}

              <button onClick={() => setChannelStep(2)} disabled={selectedPayments.length === 0}
                className="w-full py-4 bg-amber text-white rounded-2xl font-semibold text-lg hover:bg-amber/90 disabled:opacity-30 transition-all min-h-[52px]">
                Next
              </button>
              <button onClick={() => setStep('import')} className="w-full text-warm-gray mt-3 text-sm hover:text-ink">Back</button>
            </div>
          )}

          {/* ── SUB-STEP 2: Channels (Gupshup handles all DMs) ── */}
          {channelStep === 2 && (
            <div className="bg-white rounded-2xl p-6 border border-border">
              <h1 className="font-display text-2xl text-ink mb-1">Where do customers reach you?</h1>
              <p className="text-warm-gray text-sm mb-2">Klovi&apos;s AI handles all DMs &amp; replies for you</p>
              <div className="bg-green/5 border border-green/20 rounded-lg px-3 py-2 mb-5">
                <p className="text-[10px] text-green font-semibold">All messages land in your Klovi inbox — WhatsApp, Instagram &amp; Facebook DMs, comment replies, auto-replies</p>
              </div>

              {/* WhatsApp */}
              <div className="border border-border rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">🟢</span>
                  <div>
                    <p className="font-semibold text-ink text-sm">WhatsApp</p>
                    <p className="text-[10px] text-warm-gray">Customers message you, AI replies instantly</p>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <label className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                    whatsappPath === 'klovi' ? 'bg-amber/5 border-2 border-amber' : 'bg-cream border-2 border-transparent'
                  }`}>
                    <input type="radio" name="wa" checked={whatsappPath === 'klovi'} onChange={() => setWhatsappPath('klovi')}
                      className="mt-1 accent-amber" />
                    <div>
                      <p className="text-sm font-medium text-ink">Give me a Klovi number</p>
                      <p className="text-[10px] text-warm-gray">Ready in 2 mins — dedicated business number</p>
                    </div>
                  </label>
                  <label className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                    whatsappPath === 'own' ? 'bg-amber/5 border-2 border-amber' : 'bg-cream border-2 border-transparent'
                  }`}>
                    <input type="radio" name="wa" checked={whatsappPath === 'own'} onChange={() => setWhatsappPath('own')}
                      className="mt-1 accent-amber" />
                    <div>
                      <p className="text-sm font-medium text-ink">I have a spare SIM</p>
                      <p className="text-[10px] text-warm-gray">Use your own number</p>
                    </div>
                  </label>
                  {whatsappPath === 'own' && (
                    <input type="tel" value={ownWhatsapp} onChange={(e) => setOwnWhatsapp(e.target.value)}
                      className="w-full px-3 py-3 border border-border rounded-xl text-ink text-sm focus:outline-none focus:border-amber ml-7"
                      placeholder="+1 or +91 number" />
                  )}
                </div>
              </div>

              {/* Instagram */}
              <div className="border border-border rounded-xl p-4 mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">📸</span>
                  <div className="flex-1">
                    <p className="font-semibold text-ink text-sm">Instagram</p>
                    <p className="text-[10px] text-warm-gray">AI auto-replies to DMs &amp; comments</p>
                  </div>
                  {igHandle && <span className="text-green text-[10px] font-bold">Ready</span>}
                </div>
                <input type="text" value={igHandle} onChange={(e) => setIgHandle(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-xl text-ink text-sm focus:outline-none focus:border-amber"
                  placeholder="@yourbusiness" />
              </div>

              {/* Facebook */}
              <div className="border border-border rounded-xl p-4 mb-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">📘</span>
                  <div className="flex-1">
                    <p className="font-semibold text-ink text-sm">Facebook</p>
                    <p className="text-[10px] text-warm-gray">AI auto-replies to Messenger &amp; comments</p>
                  </div>
                  {fbPage && <span className="text-green text-[10px] font-bold">Ready</span>}
                </div>
                <input type="text" value={fbPage} onChange={(e) => setFbPage(e.target.value)}
                  className="w-full px-3 py-2.5 border border-border rounded-xl text-ink text-sm focus:outline-none focus:border-amber"
                  placeholder="Your Facebook page name" />
              </div>

              <p className="text-[10px] text-warm-gray text-center mb-4">You still post manually — Klovi handles all incoming messages &amp; replies</p>

              <button onClick={() => setChannelStep(3)}
                className="w-full py-4 bg-amber text-white rounded-2xl font-semibold text-lg hover:bg-amber/90 transition-all min-h-[52px]">
                Next
              </button>
              <button onClick={() => setChannelStep(1)} className="w-full text-warm-gray mt-3 text-sm hover:text-ink">Back</button>
            </div>
          )}

          {/* ── SUB-STEP 3: Brand Post ─────────────────────────── */}
          {channelStep === 3 && (
            <div className="bg-white rounded-2xl p-6 border border-border text-center">
              <div className="text-5xl mb-3">✨</div>
              <h1 className="font-display text-2xl text-ink mb-2">{t('channels.launchPost', language)}</h1>
              <p className="text-warm-gray text-sm mb-5">
                {launchPost ? 'Download & share on WhatsApp, Instagram, Facebook' : 'We\'ll create a beautiful post with your products & contact info'}
              </p>

              {/* Launch post — full bleed poster */}
              {generatingPost && !launchPost && (
                <div className="flex flex-col items-center justify-center gap-3 mb-5 py-12">
                  <div className="w-8 h-8 border-[3px] border-amber border-t-transparent rounded-full animate-spin" />
                  <p className="text-warm-gray text-sm">Finding the perfect background...</p>
                </div>
              )}

              {launchPost && (
                <>
                  <div ref={launchPostRef}
                    className="mx-auto max-w-sm rounded-2xl overflow-hidden shadow-2xl mb-3 relative"
                    style={{ aspectRatio: '4/5' }}>
                    {/* BG image */}
                    {postBgImage ? (
                      <img src={postBgImage} alt="" className="absolute inset-0 w-full h-full object-cover" crossOrigin="anonymous" />
                    ) : (
                      <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, #1a0f00 0%, #2d1810 40%, #3d2200 100%)' }} />
                    )}
                    {/* Gradient overlay — light top, heavy bottom */}
                    <div className="absolute inset-0" style={{
                      background: 'linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 35%, rgba(0,0,0,0.55) 60%, rgba(0,0,0,0.82) 100%)'
                    }} />

                    {/* Content */}
                    <div className="relative z-10 h-full flex flex-col justify-between p-5">
                      {/* TOP — Badge + Business Info */}
                      <div>
                        <div className="inline-block bg-amber text-ink text-[9px] font-extrabold px-3 py-1.5 rounded-full uppercase tracking-[0.15em] shadow-lg mb-3">
                          Now Open
                        </div>
                        <h2 className="text-white text-[28px] font-bold leading-tight drop-shadow-lg" style={{ fontFamily: 'Playfair Display, serif', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
                          {businessName || 'My Business'}
                        </h2>
                        <p className="text-white/80 text-sm mt-1 drop-shadow" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                          📍 {city}
                        </p>
                      </div>

                      {/* MIDDLE — Product image grid */}
                      {products.length > 0 && (
                        <div className="my-3">
                          <p className="text-amber text-[9px] font-bold uppercase tracking-[0.15em] mb-2 drop-shadow" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                            What We Offer
                          </p>
                          <div className="grid grid-cols-3 gap-2">
                            {products.slice(0, 6).map((p, i) => (
                              <div key={i} className="text-center">
                                <div className="w-full aspect-square rounded-lg overflow-hidden border border-white/20 shadow-md bg-black/20 backdrop-blur-sm">
                                  {p.image ? (
                                    <img src={p.image} alt={p.name} className="w-full h-full object-cover" crossOrigin="anonymous" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-white/10">
                                      <span className="text-2xl">{getEmoji(p.category)}</span>
                                    </div>
                                  )}
                                </div>
                                <p className="text-white text-[9px] font-medium mt-1 leading-tight drop-shadow truncate" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                                  {p.name}
                                </p>
                              </div>
                            ))}
                          </div>
                          {products.length > 6 && (
                            <p className="text-white/50 text-[9px] text-center mt-1.5">+{products.length - 6} more items</p>
                          )}
                        </div>
                      )}

                      {/* BOTTOM — Contact + CTA */}
                      <div>
                        {/* Amber divider */}
                        <div className="w-10 h-0.5 bg-amber mx-auto mb-3 rounded-full" />

                        {/* Contact info */}
                        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mb-3">
                          {igHandle && (
                            <span className="text-white/80 text-[10px] font-medium drop-shadow" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                              📸 {igHandle}
                            </span>
                          )}
                          {fbPage && (
                            <span className="text-white/80 text-[10px] font-medium drop-shadow" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                              📘 {fbPage}
                            </span>
                          )}
                          {(whatsappPath === 'own' && ownWhatsapp) ? (
                            <span className="text-white/80 text-[10px] font-medium drop-shadow" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                              💬 {ownWhatsapp}
                            </span>
                          ) : slug ? (
                            <span className="text-white/80 text-[10px] font-medium drop-shadow" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                              🔗 klovi.com/{slug}
                            </span>
                          ) : null}
                        </div>

                        {/* CTA */}
                        <div className="bg-amber text-ink text-center py-3 rounded-xl font-bold text-sm shadow-lg" style={{ boxShadow: '0 4px 20px rgba(245,158,11,0.4)' }}>
                          Order Now →
                        </div>

                        <p className="text-white/20 text-[7px] text-center mt-2 uppercase tracking-[0.2em]">
                          Powered by Klovi
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Refresh bg button */}
                  {postBgImages.length > 1 && (
                    <button onClick={refreshPostBg} className="text-warm-gray text-xs hover:text-amber transition-colors mb-4">
                      Try different photo 🔄
                    </button>
                  )}
                </>
              )}

              {launchPost ? (
                <>
                  <div className="flex gap-2 mb-4">
                    <button onClick={downloadLaunchPost}
                      className="flex-1 py-3 bg-cream text-ink rounded-xl font-semibold text-sm hover:bg-cream/70 transition-colors border border-border">
                      {t('channels.download', language)}
                    </button>
                    <button onClick={() => {
                      if (navigator.share) navigator.share({ title: `${businessName} is open!`, url: `${window.location.origin}/${slug}` });
                    }}
                      className="flex-1 py-3 bg-amber/10 text-amber rounded-xl font-semibold text-sm hover:bg-amber/20 transition-colors border border-amber/30">
                      {t('live.share', language)}
                    </button>
                  </div>
                  <button onClick={saveChannels}
                    disabled={saving}
                    className="w-full py-4 bg-amber text-white rounded-2xl font-semibold text-lg hover:bg-amber/90 disabled:opacity-50 transition-all min-h-[52px]">
                    {saving ? 'Going live...' : t('channels.goLive', language)}
                  </button>
                </>
              ) : (
                <button onClick={generateLaunchPost}
                  disabled={generatingPost}
                  className="w-full py-4 bg-amber text-white rounded-2xl font-semibold text-lg hover:bg-amber/90 disabled:opacity-50 transition-all min-h-[52px]">
                  {generatingPost ? 'Creating...' : 'Create My Launch Post'}
                </button>
              )}
              <button onClick={() => { setLaunchPost(null); saveChannels(); }}
                disabled={saving}
                className="w-full text-warm-gray mt-3 text-sm hover:text-ink disabled:opacity-50">
                {launchPost ? '' : 'Skip for now'}
              </button>
              <button onClick={() => setChannelStep(2)} className="w-full text-warm-gray mt-2 text-sm hover:text-ink">Back</button>
            </div>
          )}
        </div>
      )}

      {/* ═══ STEP 4b: PREVIEW — SEE YOUR SHOP BEFORE GOING LIVE ═══ */}
      {step === 'preview' && (
        <div className="max-w-xl mx-auto px-4 pb-6">
          <div className="bg-white rounded-2xl p-6 border border-border">
            <p className="text-center text-warm-gray text-sm mb-4">{t('preview.subtitle', language)}</p>

            {/* Mock storefront header */}
            <div className="bg-cream rounded-2xl p-5 mb-4">
              <h2 className="font-display text-2xl text-ink text-center">{businessName || 'Your Shop'}</h2>
              {city && <p className="text-warm-gray text-sm text-center mt-1">{city}</p>}
            </div>

            {/* Product grid preview */}
            {products.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 mb-6">
                {products.map((p, i) => (
                  <div key={i} className="bg-cream rounded-xl overflow-hidden border border-border">
                    {p.image ? (
                      <div className="aspect-square bg-warm-gray/10 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="aspect-square bg-warm-gray/5 flex items-center justify-center">
                        <span className="text-3xl">{getEmoji(p.category)}</span>
                      </div>
                    )}
                    <div className="p-2.5">
                      <p className="text-sm font-semibold text-ink truncate">{p.name}</p>
                      <p className="text-xs text-warm-gray mt-0.5">
                        {p.variants.length > 0
                          ? `${currencySymbol}${Math.min(...p.variants.map(v => v.price))}+`
                          : `${currencySymbol}${p.price}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 mb-6">
                <p className="text-warm-gray text-sm">No products added yet</p>
              </div>
            )}

            {/* Shop link preview */}
            <div className="bg-cream/50 rounded-xl p-3 mb-6 text-center">
              <p className="text-[10px] text-warm-gray uppercase tracking-wider font-semibold mb-1">{t('preview.yourLink', language)}</p>
              <p className="font-mono text-sm text-ink break-all">
                {typeof window !== 'undefined' ? window.location.origin : ''}/{slug}
              </p>
            </div>

            {/* Action buttons */}
            <button onClick={() => setStep('live')}
              className="w-full py-4 bg-amber text-white rounded-2xl font-bold text-lg hover:bg-amber/90 transition-all min-h-[52px] active:scale-[0.98] mb-3">
              {t('preview.looksGood', language)}
            </button>
            <button onClick={() => setStep('channels')}
              className="w-full py-3 bg-cream text-ink rounded-2xl font-semibold text-sm hover:bg-cream/70 transition-colors border border-border">
              {t('preview.goBack', language)}
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 5: LIVE! — THE WOW MOMENT ═══ */}
      {step === 'live' && (
        <div className="max-w-xl mx-auto px-4 pb-6">
          <div className="bg-white rounded-2xl p-6 border border-border text-center">
            {/* Celebration */}
            <div className="text-7xl mb-2 animate-bounce">🎉</div>
            <h1 className="font-display text-3xl text-ink mb-1">{t('live.title', language)}</h1>
            <p className="text-warm-gray text-base mb-6">
              <span className="font-semibold text-ink">{businessName || 'Your shop'}</span> {t('live.subtitle', language)}
            </p>

            {/* Shop link */}
            <div className="bg-cream rounded-2xl p-5 mb-6">
              <p className="text-[10px] text-warm-gray uppercase tracking-wider font-semibold mb-2">{t('live.shopLink', language)}</p>
              <p className="font-mono font-semibold text-ink text-sm break-all mb-3">
                {typeof window !== 'undefined' ? window.location.origin : ''}/{slug}
              </p>
              <div className="flex gap-2">
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/${slug}`); }}
                  className="flex-1 py-3 bg-ink text-white rounded-xl font-semibold text-sm hover:bg-ink/90 transition-colors active:scale-[0.97]">
                  {t('live.copy', language)}
                </button>
                <button onClick={() => {
                  if (navigator.share) navigator.share({ title: businessName, url: `${window.location.origin}/${slug}` });
                  else window.open(`https://wa.me/?text=${encodeURIComponent(`Check out ${businessName}! ${window.location.origin}/${slug}`)}`, '_blank');
                }}
                  className="flex-1 py-3 bg-amber text-white rounded-xl font-semibold text-sm hover:bg-amber/90 transition-colors active:scale-[0.97]">
                  {t('live.share', language)}
                </button>
              </div>
            </div>

            {/* Quick share options */}
            <div className="space-y-2.5 mb-6">
              <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Hey! I just launched my business on Klovi. Check it out: ${window.location.origin}/${slug}`)}`, '_blank')}
                className="w-full flex items-center gap-3 py-3.5 px-4 bg-green/10 rounded-xl hover:bg-green/20 transition-colors text-left">
                <span className="text-xl">🟢</span>
                <span className="text-sm font-medium text-ink flex-1">{t('live.shareWhatsApp', language)}</span>
                <span className="text-warm-gray text-sm">&rarr;</span>
              </button>
              <button onClick={() => window.open(`https://www.instagram.com/`, '_blank')}
                className="w-full flex items-center gap-3 py-3.5 px-4 bg-purple/10 rounded-xl hover:bg-purple/20 transition-colors text-left">
                <span className="text-xl">📸</span>
                <span className="text-sm font-medium text-ink flex-1">{t('live.shareInsta', language)}</span>
                <span className="text-warm-gray text-sm">&rarr;</span>
              </button>
              <button onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/${slug}`)}`, '_blank')}
                className="w-full flex items-center gap-3 py-3.5 px-4 bg-blue/10 rounded-xl hover:bg-blue/20 transition-colors text-left">
                <span className="text-xl">📘</span>
                <span className="text-sm font-medium text-ink flex-1">{t('live.shareFb', language)}</span>
                <span className="text-warm-gray text-sm">&rarr;</span>
              </button>
            </div>

            {/* Launch post card */}
            {launchPost && (
              <div className="bg-cream rounded-2xl p-4 mb-6 text-left">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">✨</span>
                  <p className="text-sm font-semibold text-ink">{t('live.launchPost', language)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={downloadLaunchPost}
                    className="flex-1 py-2.5 bg-white border border-border rounded-lg text-xs font-semibold text-ink hover:bg-cream transition-colors">
                    {t('live.downloadImage', language)}
                  </button>
                  <button onClick={() => {
                    if (navigator.share) navigator.share({ title: `${businessName} is live!`, url: `${window.location.origin}/${slug}` });
                  }}
                    className="flex-1 py-2.5 bg-amber text-white rounded-lg text-xs font-semibold hover:bg-amber/90 transition-colors">
                    {t('live.shareNow', language)}
                  </button>
                </div>
              </div>
            )}

            {/* Go to Dashboard */}
            <button onClick={() => { router.push('/dashboard'); router.refresh(); }}
              className="w-full py-4 bg-amber text-white rounded-2xl font-bold text-lg hover:bg-amber/90 transition-all min-h-[52px] active:scale-[0.98]">
              {t('live.dashboard', language)}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
