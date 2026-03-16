'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/** Resize Supabase Storage images via transform API — converts 2MB PNGs to ~80KB WebP */
function optimizeImg(url: string | null, width: number): string | null {
  if (!url) return null;
  // Only transform Supabase Storage URLs
  if (url.includes('.supabase.co/storage/v1/object/public/')) {
    return url.replace(
      '/storage/v1/object/public/',
      `/storage/v1/render/image/public/`
    ) + `?width=${width}&resize=contain&format=origin`;
  }
  return url;
}

interface Variant { label: string; price: number }

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  images: string[] | null;
  enhanced_images: string[] | null;
  variants: any;
  status: string;
  lead_time_hours?: number;
  advance_booking_days?: number;
  min_order_quantity?: number;
  dietary_tags?: string[];
  currency?: string;
}

interface Seller {
  id: string;
  business_name: string;
  slug: string;
  category: string;
  city: string;
  country?: string;
  avatar_url?: string;
  allows_custom_orders: boolean;
  delivery_type?: string;
  fulfillment_modes?: string[];
}

interface Props {
  products: Product[];
  seller: Seller;
  waNumber: string;
  businessName: string;
  category: string;
  country?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  stitching: 'Stitching & Tailoring', tailoring: 'Tailoring', food: 'Home Food',
  bakery: 'Bakery', snacks: 'Snacks', pickle: 'Pickles & Preserves',
  sweets: 'Sweets', jewelry: 'Jewelry', beauty: 'Beauty & Skincare',
  crafts: 'Handmade Crafts', coaching: 'Coaching', tutoring: 'Tutoring',
  wellness: 'Wellness', clothing: 'Clothing & Fashion', plants: 'Plants & Garden',
  fitness: 'Fitness', candle: 'Candles', chocolate: 'Chocolates',
  healing: 'Healing & Spiritual', nutrition: 'Nutrition', services: 'Services',
  healthy: 'Healthy Snacks', masala: 'Spices & Masala', hamper: 'Gift Hampers',
  tiffin: 'Tiffin Service',
};

const CAT_ICON: Record<string, { icon: string; bg: string }> = {
  blouse: { icon: '👚', bg: 'bg-rose-50' }, kurti: { icon: '👗', bg: 'bg-fuchsia-50' },
  suit: { icon: '🪡', bg: 'bg-violet-50' }, salwar: { icon: '🪡', bg: 'bg-violet-50' },
  lehenga: { icon: '✨', bg: 'bg-amber-50' }, saree: { icon: '🧵', bg: 'bg-pink-50' },
  alteration: { icon: '✂️', bg: 'bg-sky-50' }, curtain: { icon: '🪟', bg: 'bg-teal-50' },
  dress: { icon: '👗', bg: 'bg-indigo-50' }, earring: { icon: '✨', bg: 'bg-amber-50' },
  necklace: { icon: '📿', bg: 'bg-violet-50' }, ring: { icon: '💍', bg: 'bg-pink-50' },
  cake: { icon: '🎂', bg: 'bg-pink-50' }, cookie: { icon: '🍪', bg: 'bg-amber-50' },
  snack: { icon: '🥨', bg: 'bg-orange-50' }, sweet: { icon: '🍬', bg: 'bg-rose-50' },
  biryani: { icon: '🍚', bg: 'bg-amber-50' }, pickle: { icon: '🫙', bg: 'bg-green-50' },
  plant: { icon: '🌿', bg: 'bg-green-50' }, candle: { icon: '🕯️', bg: 'bg-amber-50' },
  chocolate: { icon: '🍫', bg: 'bg-amber-50' }, yoga: { icon: '🧘', bg: 'bg-teal-50' },
};

function getCatIcon(name: string, fallback: string) {
  const l = name.toLowerCase();
  for (const [k, v] of Object.entries(CAT_ICON)) { if (l.includes(k)) return v; }
  return { icon: fallback, bg: 'bg-[#faf8f5]' };
}

function parseVariants(v: any): Variant[] {
  try {
    const parsed = typeof v === 'string' ? JSON.parse(v) : v;
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.price > 0) return parsed;
  } catch {}
  return [];
}

function getCategoryLabel(raw: string): string {
  const l = raw.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_LABELS)) { if (l.includes(k)) return v; }
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default function StorefrontProducts({ products, seller, waNumber, businessName, category, country }: Props) {
  const [activeTab, setActiveTab] = useState('All');
  const [productImages, setProductImages] = useState<Record<string, string>>({});
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(20);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [orderMessage, setOrderMessage] = useState('');
  const [messageLoading, setMessageLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);

  const isIndia = (country || seller.country || '').toLowerCase() === 'india';
  const currSym = isIndia ? '₹' : '$';
  const currency = isIndia ? 'INR' : 'USD';

  // Detect layout from seller category first, then from product categories as fallback
  const gridCategories = ['bakery', 'sweets', 'snacks', 'pickle', 'chocolate', 'jewelry', 'candle', 'plants', 'beauty', 'hamper', 'healthy', 'masala', 'food'];
  const serviceCategories = ['stitching', 'tailoring', 'tutoring', 'coaching', 'nutrition', 'healing', 'spiritual', 'service', 'beauty', 'fitness', 'yoga', 'meditation', 'counseling', 'consulting', 'therapy'];

  // Check if products are actually services despite seller category being food/product
  const productCats = products.map(p => (p.category || '').toLowerCase()).filter(Boolean);
  const productsAreServices = productCats.length > 0 && productCats.every(pc => serviceCategories.some(sc => pc.includes(sc)));
  const effectiveCategory = productsAreServices ? productCats[0] : category.toLowerCase();

  const useGridLayout = !productsAreServices && gridCategories.some(c => category.toLowerCase().includes(c));

  const allCategories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean) as string[]))];
  const showTabs = allCategories.length > 2;
  const tabCounts: Record<string, number> = {};
  allCategories.forEach(cat => {
    tabCounts[cat] = cat === 'All' ? products.length : products.filter(p => p.category === cat).length;
  });

  const filtered = products
    .filter(p => activeTab === 'All' || p.category === activeTab)
    .filter(p => !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const visibleProducts = filtered.slice(0, visibleCount);

  function getImg(p: Product): string | null {
    return p.images?.[0] || p.enhanced_images?.[0] || productImages[p.id] || null;
  }

  // Fetch Pexels images for products without images
  useEffect(() => {
    const noImage = products.filter(p => !p.images?.[0] && !p.enhanced_images?.[0]);
    if (noImage.length === 0) return;
    const fetchBatch = async (batch: Product[]) => {
      await Promise.all(batch.map(async (product) => {
        try {
          const res = await fetch(`/api/pexels-image?query=${encodeURIComponent(`${product.name} indian`)}&product_id=${product.id}`);
          const { url } = await res.json();
          if (url) setProductImages(prev => ({ ...prev, [product.id]: url }));
        } catch {}
      }));
    };
    for (let i = 0; i < noImage.length; i += 5) fetchBatch(noImage.slice(i, i + 5));
  }, [products]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setVisibleCount(prev => Math.min(prev + 20, filtered.length)); },
      { threshold: 0.1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [filtered.length, visibleCount]);

  useEffect(() => { setVisibleCount(20); }, [activeTab, searchQuery]);

  const generateOrderMessage = useCallback(async (product: Product, variant: Variant | null, qty: number) => {
    setMessageLoading(true);
    try {
      const res = await fetch('/api/generate-order-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName, category, product_name: product.name,
          product_description: product.description, variant_label: variant?.label || null,
          variant_price: variant?.price || product.price, currency, quantity: qty,
          location: seller.city, allows_custom: seller.allows_custom_orders,
          delivery_type: seller.delivery_type || seller.fulfillment_modes?.[0], seller_slug: seller.slug,
        }),
      });
      const { message } = await res.json();
      setOrderMessage(message);
    } catch {
      const varStr = variant ? ` — ${variant.label}` : '';
      setOrderMessage(`Hi! I'd like to order ${qty > 1 ? qty + 'x ' : ''}*${product.name}*${varStr} (${currSym}${variant?.price || product.price}) from *${businessName}*.\nMenu: kloviapp.com/${seller.slug}`);
    } finally {
      setMessageLoading(false);
    }
  }, [businessName, category, currency, currSym, seller]);

  const openSheet = (product: Product) => {
    setSelectedProduct(product);
    const variants = parseVariants(product.variants);
    setSelectedVariant(variants[0] || null);
    setQuantity(1);
    setSheetOpen(true);
    generateOrderMessage(product, variants[0] || null, 1);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setSelectedProduct(null);
    setSelectedVariant(null);
    setOrderMessage('');
    setQuantity(1);
  };

  useEffect(() => {
    if (selectedProduct && sheetOpen) generateOrderMessage(selectedProduct, selectedVariant, quantity);
  }, [selectedVariant, quantity]);

  const isService = productsAreServices || serviceCategories.some(c => category.toLowerCase().includes(c));

  return (
    <div>
      {/* Tab bar + search */}
      {(showTabs || products.length >= 50) && (
        <div className="sticky top-0 z-40 bg-[#faf8f5]/95 backdrop-blur-sm border-b border-[#e7e0d4]">
          <div className="flex items-center gap-1 px-4 py-2">
            <div className="flex gap-1.5 overflow-x-auto flex-1 scrollbar-hide">
              {allCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setActiveTab(cat); setShowSearch(false); }}
                  className={`text-[11px] h-[40px] px-3 rounded-full font-semibold whitespace-nowrap transition-colors ${
                    activeTab === cat ? 'bg-ink text-white' : 'bg-white text-warm-gray border border-[#e7e0d4]'
                  }`}
                >
                  {cat === 'All' ? 'All' : getCategoryLabel(cat)} ({tabCounts[cat]})
                </button>
              ))}
            </div>
            {products.length >= 50 && (
              <button onClick={() => setShowSearch(!showSearch)} className="w-10 h-10 flex-shrink-0 rounded-full bg-white border border-[#e7e0d4] flex items-center justify-center text-sm">🔍</button>
            )}
          </div>
          {showSearch && (
            <div className="px-4 pb-2">
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search products..." className="w-full h-10 px-4 rounded-xl border border-[#e7e0d4] bg-white text-sm text-ink placeholder:text-warm-gray focus:outline-none focus:border-amber" autoFocus />
            </div>
          )}
        </div>
      )}

      {/* Products heading */}
      <div className="px-4 pt-4 pb-1">
        <h2 className="font-display text-base font-black text-ink">{useGridLayout ? 'Our Menu' : productsAreServices ? 'Our Services' : 'Our Products'}</h2>
      </div>

      {/* Product grid/list */}
      <div className="px-4 pt-2 pb-4">
        {useGridLayout ? (
          /* ═══ GRID LAYOUT ═══ */
          <div className="grid grid-cols-2 gap-3">
            {visibleProducts.map(product => {
              const img = getImg(product);
              const catIcon = getCatIcon(product.name, '🛍️');
              const variants = parseVariants(product.variants);
              const minP = variants.length ? Math.min(...variants.map(v => v.price)) : product.price;
              const maxP = variants.length ? Math.max(...variants.map(v => v.price)) : product.price;
              const dietaryDot = product.dietary_tags?.includes('veg') ? '🟢' : product.dietary_tags?.includes('non-veg') ? '🔴' : null;

              return (
                <div key={product.id} className="bg-white rounded-2xl border border-[#e7e0d4] overflow-hidden cursor-pointer active:scale-[0.98] transition-transform" onClick={() => openSheet(product)}>
                  {/* Image — 4:3 aspect ratio */}
                  <div className="aspect-[3/4] overflow-hidden relative">
                    {img ? (
                      <>
                        {!loadedImages[product.id] && <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse" />}
                        <img src={optimizeImg(img, 400) || img} alt={product.name} className={`w-full h-full object-cover transition-opacity duration-300 ${loadedImages[product.id] ? 'opacity-100' : 'opacity-0'}`} loading="lazy" onLoad={() => setLoadedImages(prev => ({ ...prev, [product.id]: true }))} />
                      </>
                    ) : (
                      <div className={`w-full h-full ${catIcon.bg} flex flex-col items-center justify-center gap-1`}>
                        <span className="text-4xl">{catIcon.icon}</span>
                      </div>
                    )}
                    {/* Dietary dot */}
                    {dietaryDot && (
                      <span className="absolute top-2 right-2 text-sm">{dietaryDot}</span>
                    )}
                  </div>
                  <div className="p-3">
                    <h4 className="font-semibold text-[14px] text-ink leading-tight line-clamp-2">{product.name}</h4>
                    {/* Description — critical for trust */}
                    {product.description && (
                      <p className="text-[12px] text-warm-gray mt-0.5 line-clamp-2 leading-relaxed">{product.description}</p>
                    )}
                    <p className="font-display font-bold text-amber text-[15px] mt-1.5">
                      {currSym}{minP}{maxP > minP ? ` – ${currSym}${maxP}` : ''}
                    </p>
                    {variants.length > 0 && (
                      <p className="text-[10px] text-warm-gray mt-0.5">{variants.length} options</p>
                    )}
                    <p className="text-[9px] text-warm-gray/50 mt-2">Tap to order</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ═══ LIST LAYOUT ═══ */
          <div className="space-y-3">
            {visibleProducts.map(product => {
              const img = getImg(product);
              const catIcon = getCatIcon(product.name, '✂️');
              const variants = parseVariants(product.variants);
              const minP = variants.length ? Math.min(...variants.map(v => v.price)) : product.price;
              const maxP = variants.length ? Math.max(...variants.map(v => v.price)) : product.price;

              return (
                <div key={product.id} className="bg-white rounded-2xl border border-[#e7e0d4] overflow-hidden cursor-pointer active:scale-[0.98] transition-transform" onClick={() => openSheet(product)}>
                  <div className="flex">
                    {/* Left: image — larger */}
                    <div className="w-24 h-24 flex-shrink-0 overflow-hidden">
                      {img ? (
                        <img src={optimizeImg(img, 200) || img} alt={product.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className={`w-full h-full ${catIcon.bg} flex items-center justify-center`}>
                          <span className="text-2xl">{catIcon.icon}</span>
                        </div>
                      )}
                    </div>
                    {/* Right: info */}
                    <div className="flex-1 p-3 min-w-0 flex flex-col justify-center">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-semibold text-[14px] text-ink leading-tight flex-1 min-w-0">{product.name}</h4>
                        <span className="text-warm-gray/40 text-sm flex-shrink-0">›</span>
                      </div>
                      {product.description && <p className="text-[12px] text-warm-gray mt-0.5 line-clamp-3 leading-relaxed">{product.description}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <p className="font-display font-bold text-amber text-[14px]">
                          {currSym}{minP}{maxP > minP ? ` – ${currSym}${maxP}` : ''}
                        </p>
                        {product.lead_time_hours && (
                          <span className="text-[10px] text-warm-gray">⏱ Ready in {product.lead_time_hours}h</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Variant pills */}
                  {variants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                      {variants.map((v, i) => (
                        <span key={i} className="text-[10px] bg-[#faf8f5] text-ink px-2 py-1 rounded-full border border-[#e7e0d4] font-medium">
                          {v.label} — <span className="text-amber font-bold">{currSym}{v.price}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        {visibleCount < filtered.length && <div ref={loaderRef} className="h-4 mt-4" />}

        {filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-warm-gray text-sm">{searchQuery ? 'No products match your search' : 'No products in this category'}</p>
          </div>
        )}
      </div>

      {/* ═══ BOTTOM SHEET ═══ */}
      {sheetOpen && selectedProduct && (
        <div className="fixed inset-0 z-[60]" onClick={closeSheet}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Drag handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Seller identity at top of sheet */}
            <div className="flex items-center gap-2.5 px-4 pb-3 border-b border-[#e7e0d4]">
              {seller.avatar_url ? (
                <img src={seller.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-[#e7e0d4]" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-amber/10 flex items-center justify-center text-sm">🛍️</div>
              )}
              <div>
                <p className="text-[13px] font-semibold text-ink">{businessName}</p>
                <p className="text-[10px] text-warm-gray">Homemade with love in {seller.city}</p>
              </div>
            </div>

            {/* Product image */}
            {(() => {
              const img = getImg(selectedProduct);
              const catIcon = getCatIcon(selectedProduct.name, '🛍️');
              return img ? (
                <div className="w-full h-60 overflow-hidden relative">
                  <img src={optimizeImg(img, 480) || img} alt={selectedProduct.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className={`w-full h-40 ${catIcon.bg} flex items-center justify-center`}>
                  <span className="text-6xl">{catIcon.icon}</span>
                </div>
              );
            })()}

            <div className="p-4">
              {selectedProduct.category && (
                <span className="text-[10px] bg-amber/10 text-amber font-bold px-2 py-0.5 rounded-full">{getCategoryLabel(selectedProduct.category)}</span>
              )}
              <h3 className="font-display text-2xl font-black text-ink mt-1">{selectedProduct.name}</h3>

              {/* Price */}
              {(() => {
                const variants = parseVariants(selectedProduct.variants);
                const minP = variants.length ? Math.min(...variants.map(v => v.price)) : selectedProduct.price;
                const maxP = variants.length ? Math.max(...variants.map(v => v.price)) : selectedProduct.price;
                return (
                  <p className="font-display font-bold text-amber text-xl mt-1">
                    {currSym}{minP}{maxP > minP ? ` – ${currSym}${maxP}` : ''}
                  </p>
                );
              })()}

              {selectedProduct.description && (
                <p className="text-sm text-warm-gray leading-relaxed mt-3">{selectedProduct.description}</p>
              )}

              {/* Variant selector */}
              {(() => {
                const variants = parseVariants(selectedProduct.variants);
                if (variants.length === 0) return null;
                return (
                  <div className="mt-4">
                    <p className="text-[10px] text-warm-gray font-bold tracking-wider mb-2">SELECT OPTION</p>
                    <div className="flex flex-wrap gap-2">
                      {variants.map((v, i) => (
                        <button key={i} onClick={() => setSelectedVariant(v)}
                          className={`text-xs px-3 py-2 rounded-full font-semibold transition-colors ${
                            selectedVariant?.label === v.label ? 'bg-amber text-white' : 'bg-white text-ink border border-[#e7e0d4]'
                          }`}>
                          {v.label} — {currSym}{v.price}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Meta info */}
              <div className="flex flex-wrap gap-2 mt-4">
                {selectedProduct.lead_time_hours && <span className="text-[10px] bg-[#faf8f5] text-warm-gray px-2 py-1 rounded-full">⏱ {selectedProduct.lead_time_hours}h turnaround</span>}
                {selectedProduct.advance_booking_days && <span className="text-[10px] bg-[#faf8f5] text-warm-gray px-2 py-1 rounded-full">📅 Book {selectedProduct.advance_booking_days} days ahead</span>}
                {selectedProduct.dietary_tags?.length && <span className="text-[10px] bg-[#faf8f5] text-warm-gray px-2 py-1 rounded-full">🥗 {selectedProduct.dietary_tags.join(' · ')}</span>}
                {(selectedProduct.min_order_quantity || 0) > 1 && <span className="text-[10px] bg-[#faf8f5] text-warm-gray px-2 py-1 rounded-full">📦 Min: {selectedProduct.min_order_quantity}</span>}
              </div>

              {/* Quantity selector — NOT for services */}
              {!isService && (
                <div className="flex items-center gap-3 mt-4">
                  <p className="text-[10px] text-warm-gray font-bold tracking-wider">QUANTITY</p>
                  <div className="flex items-center border border-[#e7e0d4] rounded-xl overflow-hidden">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 text-ink text-lg font-bold hover:bg-[#faf8f5]">−</button>
                    <span className="w-10 h-10 flex items-center justify-center text-sm font-bold text-ink border-x border-[#e7e0d4]">{quantity}</span>
                    <button onClick={() => setQuantity(q => q + 1)} className="w-10 h-10 text-ink text-lg font-bold hover:bg-[#faf8f5]">+</button>
                  </div>
                </div>
              )}

              {/* Message preview */}
              <div className="bg-[#faf8f5] rounded-2xl p-4 mt-4 border border-[#e7e0d4]">
                <p className="text-[10px] text-warm-gray mb-1.5 font-medium tracking-wider">MESSAGE PREVIEW</p>
                {messageLoading ? (
                  <div className="space-y-2">
                    <div className="h-3 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse rounded w-full" />
                    <div className="h-3 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse rounded w-4/5" />
                  </div>
                ) : (
                  <p className="text-[13px] text-ink leading-relaxed whitespace-pre-line">{orderMessage}</p>
                )}
              </div>

              {/* CTA */}
              <div className="pb-28 pt-3">
                {waNumber ? (
                  messageLoading ? (
                    <button disabled className="w-full h-14 rounded-2xl bg-green/60 text-white font-semibold text-base flex items-center justify-center gap-2 cursor-not-allowed">Preparing message...</button>
                  ) : (
                    <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(orderMessage)}`} target="_blank" rel="noopener noreferrer"
                      className="w-full h-14 rounded-2xl bg-green text-white font-semibold text-base flex items-center justify-center gap-2 shadow-lg shadow-green/20 active:scale-[0.98] transition-all">
                      💬 Order on WhatsApp
                      {selectedVariant && <span className="text-green-200 text-sm font-normal ml-1">· {currSym}{selectedVariant.price}</span>}
                    </a>
                  )
                ) : (
                  <span className="w-full h-14 rounded-2xl bg-gray-200 text-warm-gray text-base flex items-center justify-center">WhatsApp not available</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
