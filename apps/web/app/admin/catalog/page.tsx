'use client';

import { useState, useMemo } from 'react';
import { CATALOG_CATEGORIES, CATALOG_PRODUCTS, CatalogProduct } from '@/data/product-catalog';

export default function AdminCatalog() {
  const [activeCategory, setActiveCategory] = useState(CATALOG_CATEGORIES[0].name);
  const [search, setSearch] = useState('');
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [editForm, setEditForm] = useState<Partial<CatalogProduct>>({});
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [fetchingImage, setFetchingImage] = useState<string | null>(null);

  // Products for current category
  const products = useMemo(() => {
    let filtered = CATALOG_PRODUCTS.filter(p => p.parentCategory === activeCategory);
    if (search) {
      const q = search.toLowerCase();
      filtered = CATALOG_PRODUCTS.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.parentCategory.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [activeCategory, search]);

  // Count per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CATALOG_PRODUCTS.forEach(p => {
      counts[p.parentCategory] = (counts[p.parentCategory] || 0) + 1;
    });
    return counts;
  }, []);

  // Fetch a Pexels image for a product
  const fetchImage = async (product: CatalogProduct) => {
    const key = product.name;
    if (imageUrls[key]) return;
    setFetchingImage(key);
    try {
      const query = product.pexelsQuery || `${product.name} ${product.parentCategory} indian`;
      const res = await fetch(`/api/pexels-image?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.url) {
        setImageUrls(prev => ({ ...prev, [key]: data.url }));
      }
    } catch { /* skip */ }
    setFetchingImage(null);
  };

  const startEdit = (product: CatalogProduct) => {
    setEditingProduct(product);
    setEditForm({ ...product });
  };

  const cancelEdit = () => {
    setEditingProduct(null);
    setEditForm({});
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display text-white">Product Catalog</h1>
          <p className="text-sm text-white/40 mt-1">
            {CATALOG_CATEGORIES.length} categories · {CATALOG_PRODUCTS.length} products
          </p>
        </div>
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder:text-white/30 w-64 focus:outline-none focus:border-amber/50"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-2.5 text-white/30 hover:text-white text-sm">✕</button>
          )}
        </div>
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
          {CATALOG_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.name)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                activeCategory === cat.name
                  ? 'text-white font-medium'
                  : 'text-white/40 hover:text-white/70'
              }`}
              style={activeCategory === cat.name ? { backgroundColor: `#${cat.color}30` } : {}}
            >
              <span>{cat.emoji}</span>
              {cat.name}
              <span className="text-[10px] opacity-60">({categoryCounts[cat.name] || 0})</span>
            </button>
          ))}
        </div>
      )}

      {search && (
        <div className="text-sm text-white/40 mb-4">
          {products.length} result{products.length !== 1 ? 's' : ''} for &ldquo;{search}&rdquo;
        </div>
      )}

      {/* Products grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product, i) => (
          <div key={`${product.name}-${i}`} className="bg-[#161822] rounded-xl border border-white/10 overflow-hidden">
            {/* Image area */}
            <div className="h-40 bg-white/5 flex items-center justify-center relative">
              {imageUrls[product.name] ? (
                <img
                  src={imageUrls[product.name]}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <button
                  onClick={() => fetchImage(product)}
                  disabled={fetchingImage === product.name}
                  className="text-white/20 hover:text-white/50 text-sm transition-colors"
                >
                  {fetchingImage === product.name ? (
                    <span className="animate-pulse">Loading...</span>
                  ) : (
                    <span>Click to fetch image</span>
                  )}
                </button>
              )}
              {/* Category badge */}
              <span className="absolute top-2 left-2 text-[10px] bg-black/60 text-white/70 px-2 py-0.5 rounded-full">
                {product.category}
              </span>
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-white font-medium text-sm">{product.title}</h3>
                  <p className="text-white/40 text-xs mt-1 line-clamp-2">{product.description}</p>
                </div>
                <button
                  onClick={() => startEdit(product)}
                  className="text-xs text-amber hover:text-amber/80 shrink-0"
                >
                  Edit
                </button>
              </div>

              {/* Details */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">
                  ₹{product.priceMin}–{product.priceMax}
                </span>
                <span className="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded-full">
                  {product.quantity}
                </span>
                {product.variants.length > 0 && (
                  <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">
                    {product.variants.length} variants
                  </span>
                )}
              </div>

              {/* Variants */}
              {product.variants.length > 0 && (
                <div className="mt-2 text-[10px] text-white/30 truncate">
                  {product.variants.join(' · ')}
                </div>
              )}

              {/* Highlights */}
              <div className="mt-2 text-[10px] text-white/20 truncate">
                {product.highlights}
              </div>

              {product.dietary.length > 0 && (
                <div className="mt-1.5 flex gap-1">
                  {product.dietary.map(d => (
                    <span key={d} className="text-[9px] bg-amber/10 text-amber px-1.5 py-0.5 rounded">
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {products.length === 0 && (
        <div className="text-center text-white/30 py-16">No products found</div>
      )}

      {/* Edit modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={cancelEdit}>
          <div
            className="bg-[#1a1d2e] rounded-2xl border border-white/10 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-white font-medium">Edit Product</h2>
              <button onClick={cancelEdit} className="text-white/40 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs text-white/50 block mb-1">Title</label>
                <input
                  value={editForm.title || ''}
                  onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber/50"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-white/50 block mb-1">Description</label>
                <textarea
                  value={editForm.description || ''}
                  onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber/50 resize-none"
                />
              </div>

              {/* Highlights */}
              <div>
                <label className="text-xs text-white/50 block mb-1">Highlights</label>
                <input
                  value={editForm.highlights || ''}
                  onChange={(e) => setEditForm(f => ({ ...f, highlights: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber/50"
                />
              </div>

              {/* Price range */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/50 block mb-1">Min Price (₹)</label>
                  <input
                    type="number"
                    value={editForm.priceMin || 0}
                    onChange={(e) => setEditForm(f => ({ ...f, priceMin: Number(e.target.value) }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/50 block mb-1">Max Price (₹)</label>
                  <input
                    type="number"
                    value={editForm.priceMax || 0}
                    onChange={(e) => setEditForm(f => ({ ...f, priceMax: Number(e.target.value) }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber/50"
                  />
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="text-xs text-white/50 block mb-1">Quantity / Unit</label>
                <input
                  value={editForm.quantity || ''}
                  onChange={(e) => setEditForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber/50"
                />
              </div>

              {/* Variants */}
              <div>
                <label className="text-xs text-white/50 block mb-1">Variants (comma-separated)</label>
                <input
                  value={(editForm.variants || []).join(', ')}
                  onChange={(e) => setEditForm(f => ({ ...f, variants: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber/50"
                />
              </div>

              {/* Pexels query */}
              <div>
                <label className="text-xs text-white/50 block mb-1">Image Search Query (for Pexels)</label>
                <input
                  value={editForm.pexelsQuery || ''}
                  onChange={(e) => setEditForm(f => ({ ...f, pexelsQuery: e.target.value }))}
                  placeholder={`${editForm.name} ${editForm.parentCategory}`}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber/50"
                />
              </div>

              {/* Image preview */}
              {editForm.name && imageUrls[editForm.name] && (
                <div>
                  <label className="text-xs text-white/50 block mb-1">Current Image</label>
                  <img
                    src={imageUrls[editForm.name]}
                    alt={editForm.name}
                    className="w-full h-40 object-cover rounded-lg"
                  />
                </div>
              )}
            </div>

            <div className="p-5 border-t border-white/10 flex gap-3 justify-end">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 text-sm text-white/50 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // TODO: Save to DB via API when catalog_overrides table is ready
                  // For now, just close the modal
                  alert('Saved! (Catalog DB persistence coming soon — currently read-only from product-catalog.ts)');
                  cancelEdit();
                }}
                className="px-4 py-2 bg-amber text-ink text-sm font-medium rounded-lg hover:bg-amber/90"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
