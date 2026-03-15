'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

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

// Human-readable category labels
const CATEGORY_LABELS: Record<string, string> = {
  stitching: 'Stitching & Tailoring',
  tailoring: 'Tailoring',
  food: 'Home Food',
  bakery: 'Bakery',
  snacks: 'Snacks',
  pickle: 'Pickles & Preserves',
  sweets: 'Sweets',
  jewelry: 'Jewelry',
  beauty: 'Beauty & Skincare',
  crafts: 'Handmade Crafts',
  coaching: 'Coaching',
  tutoring: 'Tutoring',
  wellness: 'Wellness',
  clothing: 'Clothing & Fashion',
  plants: 'Plants & Garden',
  fitness: 'Fitness',
  candle: 'Candles',
  chocolate: 'Chocolates',
  healing: 'Healing & Spiritual',
  nutrition: 'Nutrition',
  services: 'Services',
  healthy: 'Healthy Snacks',
  masala: 'Spices & Masala',
  hamper: 'Gift Hampers',
  tiffin: 'Tiffin Service',
};

// Category icon fallbacks
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
  for (const [k, v] of Object.entries(CAT_ICON)) {
    if (l.includes(k)) return v;
  }
  return { icon: fallback, bg: 'bg-cream' };
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
  for (const [k, v] of Object.entries(CATEGORY_LABELS)) {
    if (l.includes(k)) return v;
  }
  // Capitalize first letter as fallback
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export default function StorefrontProducts({ products, seller, waNumber, businessName, category, country }: Props) {
  // State
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
  const tabRef = useRef<HTMLButtonElement>(null);

  // Currency: use seller's country, then product currency, then default
  const isIndia = (country || seller.country || '').toLowerCase() === 'india';
  const currSym = isIndia ? '₹' : '$';
  const currency = isIndia ? 'INR' : 'USD';

  // Layout detection
  const useGridLayout = ['bakery', 'sweets', 'snacks', 'pickle', 'chocolate', 'jewelry', 'candle', 'plants', 'beauty', 'hamper', 'healthy', 'masala', 'food'].some(c => category.toLowerCase().includes(c));
  const useListLayout = !useGridLayout;

  // Categories
  const allCategories = ['All', ...Array.from(new Set(products.map(p => p.category).filter(Boolean) as string[]))];
  const showTabs = allCategories.length > 2;
  const tabCounts: Record<string, number> = {};
  allCategories.forEach(cat => {
    tabCounts[cat] = cat === 'All' ? products.length : products.filter(p => p.category === cat).length;
  });

  // Filter
  const filtered = products
    .filter(p => activeTab === 'All' || p.category === activeTab)
    .filter(p => !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const visibleProducts = filtered.slice(0, visibleCount);

  // Image helper
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
          const query = `${product.name} indian`;
          const res = await fetch(`/api/pexels-image?query=${encodeURIComponent(query)}&product_id=${product.id}`);
          const { url } = await res.json();
          if (url) {
            setProductImages(prev => ({ ...prev, [product.id]: url }));
          }
        } catch {}
      }));
    };

    for (let i = 0; i < noImage.length; i += 5) {
      fetchBatch(noImage.slice(i, i + 5));
    }
  }, [products]);

  // Infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount(prev => Math.min(prev + 20, filtered.length));
        }
      },
      { threshold: 0.1 }
    );
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [filtered.length, visibleCount]);

  // Reset visible count on tab/search change
  useEffect(() => { setVisibleCount(20); }, [activeTab, searchQuery]);

  // AI message generation
  const generateOrderMessage = useCallback(async (
    product: Product, variant: Variant | null, qty: number
  ) => {
    setMessageLoading(true);
    try {
      const res = await fetch('/api/generate-order-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: businessName,
          category: category,
          product_name: product.name,
          product_description: product.description,
          variant_label: variant?.label || null,
          variant_price: variant?.price || product.price,
          currency: currency,
          quantity: qty,
          location: seller.city,
          allows_custom: seller.allows_custom_orders,
          delivery_type: seller.delivery_type || seller.fulfillment_modes?.[0],
          seller_slug: seller.slug,
        }),
      });
      const { message } = await res.json();
      setOrderMessage(message);
    } catch {
      const varStr = variant ? ` — ${variant.label}` : '';
      const priceStr = variant?.price || product.price;
      setOrderMessage(`Hi! I'd like to order ${qty > 1 ? qty + 'x ' : ''}*${product.name}*${varStr} (${currSym}${priceStr}) from *${businessName}* (klovi/${seller.slug}). Can you share availability? 🙏`);
    } finally {
      setMessageLoading(false);
    }
  }, [businessName, category, currency, currSym, seller]);

  // Open bottom sheet
  const openSheet = (product: Product) => {
    setSelectedProduct(product);
    const variants = parseVariants(product.variants);
    const defaultVariant = variants[0] || null;
    setSelectedVariant(defaultVariant);
    setQuantity(1);
    setSheetOpen(true);
    generateOrderMessage(product, defaultVariant, 1);
  };

  // Close bottom sheet
  const closeSheet = () => {
    setSheetOpen(false);
    setSelectedProduct(null);
    setSelectedVariant(null);
    setOrderMessage('');
    setQuantity(1);
  };

  // Re-generate when variant/quantity changes
  useEffect(() => {
    if (selectedProduct && sheetOpen) {
      generateOrderMessage(selectedProduct, selectedVariant, quantity);
    }
  }, [selectedVariant, quantity]);

  // Is service category (no quantity selector)
  const isService = ['stitching', 'tailoring', 'tutoring', 'coaching', 'nutrition', 'healing', 'service'].some(c => category.toLowerCase().includes(c));

  return (
    <div>
      {/* Tab bar + search */}
      {(showTabs || products.length >= 50) && (
        <div className="sticky top-0 z-40 bg-cream/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center gap-1 px-4 py-2">
            <div className="flex gap-1 overflow-x-auto flex-1 scrollbar-hide">
              {allCategories.map(cat => (
                <button
                  key={cat}
                  ref={activeTab === cat ? tabRef : undefined}
                  onClick={() => { setActiveTab(cat); setShowSearch(false); }}
                  className={`text-[11px] h-[44px] px-3 rounded-full font-semibold whitespace-nowrap transition-colors flex items-center ${
                    activeTab === cat ? 'bg-ink text-white' : 'bg-white text-warm-gray border border-border hover:border-amber'
                  }`}
                >
                  {cat === 'All' ? 'All' : getCategoryLabel(cat)} ({tabCounts[cat]})
                </button>
              ))}
            </div>
            {products.length >= 50 && (
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="w-[44px] h-[44px] flex-shrink-0 rounded-full bg-white border border-border flex items-center justify-center text-base"
              >
                🔍
              </button>
            )}
          </div>
          {showSearch && (
            <div className="px-4 pb-2">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full h-10 px-4 rounded-xl border border-border bg-white text-sm text-ink placeholder:text-warm-gray focus:outline-none focus:border-amber"
                autoFocus
              />
            </div>
          )}
        </div>
      )}

      {/* Product grid/list */}
      <div className="px-4 pt-3 pb-4">
        {useGridLayout ? (
          <div className="grid grid-cols-2 gap-2.5">
            {visibleProducts.map(product => {
              const img = getImg(product);
              const catIcon = getCatIcon(product.name, '🛍️');
              const variants = parseVariants(product.variants);
              const minP = variants.length ? Math.min(...variants.map(v => v.price)) : product.price;
              const maxP = variants.length ? Math.max(...variants.map(v => v.price)) : product.price;

              return (
                <div key={product.id} className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm cursor-pointer active:scale-[0.98] transition-transform" onClick={() => openSheet(product)}>
                  <div className="aspect-square overflow-hidden relative">
                    {img ? (
                      <>
                        {!loadedImages[product.id] && <div className="absolute inset-0 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse" />}
                        <img src={img} alt={product.name} className={`w-full h-full object-cover brightness-105 contrast-105 saturate-110 transition-opacity duration-300 ${loadedImages[product.id] ? 'opacity-100' : 'opacity-0'}`} loading="lazy" onLoad={() => setLoadedImages(prev => ({ ...prev, [product.id]: true }))} />
                        <div className="absolute inset-0 bg-amber-900/[0.03] pointer-events-none" />
                      </>
                    ) : (
                      <div className={`w-full h-full ${catIcon.bg} flex flex-col items-center justify-center gap-1`}>
                        <span className="text-4xl">{catIcon.icon}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2.5">
                    <h4 className="font-semibold text-[13px] text-ink leading-tight line-clamp-2">{product.name}</h4>
                    <p className="font-display font-bold text-amber text-[14px] mt-1">
                      {currSym}{minP}{maxP > minP ? `–${currSym}${maxP}` : ''}
                    </p>
                    {variants.length > 0 && (
                      <p className="text-[10px] text-warm-gray mt-0.5">{variants.length} options available</p>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); openSheet(product); }} className="mt-2 w-full h-9 rounded-lg bg-amber/10 text-amber text-[11px] font-semibold flex items-center justify-center hover:bg-amber hover:text-white transition-colors border border-amber/20">
                      Order →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleProducts.map(product => {
              const img = getImg(product);
              const catIcon = getCatIcon(product.name, '✂️');
              const variants = parseVariants(product.variants);
              const minP = variants.length ? Math.min(...variants.map(v => v.price)) : product.price;
              const maxP = variants.length ? Math.max(...variants.map(v => v.price)) : product.price;

              return (
                <div key={product.id} className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm cursor-pointer active:scale-[0.98] transition-transform" onClick={() => openSheet(product)}>
                  <div className="flex">
                    {/* Left: image or icon */}
                    <div className="w-20 h-20 flex-shrink-0 overflow-hidden relative">
                      {img ? (
                        <img src={img} alt={product.name} className="w-full h-full object-cover brightness-105 contrast-105 saturate-110" loading="lazy" />
                      ) : (
                        <div className={`w-full h-full ${catIcon.bg} flex items-center justify-center`}>
                          <span className="text-2xl">{catIcon.icon}</span>
                        </div>
                      )}
                    </div>
                    {/* Right: info */}
                    <div className="flex-1 p-3 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-semibold text-[15px] text-ink leading-tight flex-1 min-w-0">{product.name}</h4>
                        <p className="font-display font-bold text-amber text-[15px] flex-shrink-0">{currSym}{minP}</p>
                      </div>
                      {product.description && <p className="text-[11px] text-warm-gray mt-0.5 line-clamp-2">{product.description}</p>}
                      {maxP > minP && <p className="text-[10px] text-warm-gray mt-0.5">to {currSym}{maxP}</p>}
                    </div>
                  </div>
                  {/* Variant pills */}
                  {variants.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 px-3 pb-2.5">
                      {variants.map((v, i) => (
                        <span key={i} className="text-[10px] bg-cream text-ink px-2 py-1 rounded-full border border-border font-medium">
                          {v.label} — <span className="text-amber font-bold">{currSym}{v.price}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="px-3 pb-3">
                    <button onClick={(e) => { e.stopPropagation(); openSheet(product); }} className="w-full h-9 rounded-xl bg-green/10 text-green text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-green hover:text-white transition-colors border border-green/20">
                      💬 Order on WhatsApp
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        {visibleCount < filtered.length && (
          <div ref={loaderRef} className="h-4 mt-4" />
        )}

        {filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-warm-gray text-sm">{searchQuery ? 'No products match your search' : 'No products in this category'}</p>
          </div>
        )}
      </div>

      {/* ═══ BOTTOM SHEET ═══ */}
      {sheetOpen && selectedProduct && (
        <div className="fixed inset-0 z-[60]" onClick={closeSheet}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 transition-opacity" />

          {/* Sheet */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Drag handle */}
            <div className="flex justify-center py-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Product image */}
            {(() => {
              const img = getImg(selectedProduct);
              const catIcon = getCatIcon(selectedProduct.name, '🛍️');
              return img ? (
                <div className="w-full h-60 overflow-hidden relative">
                  <img src={img} alt={selectedProduct.name} className="w-full h-full object-cover brightness-105 contrast-105 saturate-110" />
                  <div className="absolute inset-0 bg-amber-900/[0.03] pointer-events-none" />
                </div>
              ) : (
                <div className={`w-full h-40 ${catIcon.bg} flex items-center justify-center`}>
                  <span className="text-6xl">{catIcon.icon}</span>
                </div>
              );
            })()}

            <div className="p-4">
              {/* Category badge + name */}
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

              {/* Description */}
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
                        <button
                          key={i}
                          onClick={() => setSelectedVariant(v)}
                          className={`text-xs px-3 py-2 rounded-full font-semibold transition-colors ${
                            selectedVariant?.label === v.label
                              ? 'bg-amber text-white'
                              : 'bg-white text-ink border border-border hover:border-amber'
                          }`}
                        >
                          {v.label} — {currSym}{v.price}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Meta info */}
              <div className="flex flex-wrap gap-2 mt-4">
                {selectedProduct.lead_time_hours && (
                  <span className="text-[10px] bg-cream text-warm-gray px-2 py-1 rounded-full">⏱ {selectedProduct.lead_time_hours}h turnaround</span>
                )}
                {selectedProduct.advance_booking_days && (
                  <span className="text-[10px] bg-cream text-warm-gray px-2 py-1 rounded-full">📅 Book {selectedProduct.advance_booking_days} days ahead</span>
                )}
                {selectedProduct.dietary_tags?.length && (
                  <span className="text-[10px] bg-cream text-warm-gray px-2 py-1 rounded-full">🥗 {selectedProduct.dietary_tags.join(' · ')}</span>
                )}
                {(selectedProduct.min_order_quantity || 0) > 1 && (
                  <span className="text-[10px] bg-cream text-warm-gray px-2 py-1 rounded-full">📦 Min order: {selectedProduct.min_order_quantity}</span>
                )}
              </div>

              {/* Quantity selector — NOT for services */}
              {!isService && (
                <div className="flex items-center gap-3 mt-4">
                  <p className="text-[10px] text-warm-gray font-bold tracking-wider">QUANTITY</p>
                  <div className="flex items-center gap-0 border border-border rounded-xl overflow-hidden">
                    <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-10 h-10 text-ink text-lg font-bold hover:bg-cream">−</button>
                    <span className="w-10 h-10 flex items-center justify-center text-sm font-bold text-ink border-x border-border">{quantity}</span>
                    <button onClick={() => setQuantity(q => q + 1)} className="w-10 h-10 text-ink text-lg font-bold hover:bg-cream">+</button>
                  </div>
                </div>
              )}

              {/* Message preview */}
              <div className="bg-gray-50 rounded-2xl p-4 mt-4 border border-gray-100">
                <p className="text-[10px] text-warm-gray mb-1.5 font-medium tracking-wider">MESSAGE PREVIEW</p>
                {messageLoading ? (
                  <div className="space-y-2">
                    <div className="h-3 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse rounded w-full" />
                    <div className="h-3 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse rounded w-4/5" />
                    <div className="h-3 bg-gradient-to-r from-gray-100 via-gray-200 to-gray-100 animate-pulse rounded w-3/5" />
                  </div>
                ) : (
                  <p className="text-[13px] text-ink leading-relaxed whitespace-pre-line">{orderMessage}</p>
                )}
              </div>

              {/* CTA */}
              <div className="pb-28 pt-3">
                {waNumber ? (
                  messageLoading ? (
                    <button
                      disabled
                      className="w-full h-14 rounded-2xl bg-green/60 text-white font-semibold text-base flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      Preparing message...
                    </button>
                  ) : (
                    <a
                      href={`https://wa.me/${waNumber}?text=${encodeURIComponent(orderMessage)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full h-14 rounded-2xl bg-green text-white font-semibold text-base flex items-center justify-center gap-2 shadow-lg shadow-green/20 active:scale-[0.98] transition-all"
                    >
                      💬 Order on WhatsApp
                      {selectedVariant && (
                        <span className="text-green-200 text-sm font-normal ml-1">· {currSym}{selectedVariant.price}</span>
                      )}
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
