'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CatalogCategory {
  id: number;
  name: string;
  emoji: string;
  color: string;
  enabled: boolean;
  sort_order: number;
}

interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  parent_category: string;
  title: string;
  description: string;
  highlights: string;
  variants: string[];
  quantity: string;
  price_min: number;
  price_max: number;
  dietary: string[];
  ingredients: string | null;
  pexels_query: string | null;
  image_url: string | null;
  enabled: boolean;
  sort_order: number;
}

export default function AdminCatalog() {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('');
  const [search, setSearch] = useState('');

  // Edit product
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [editForm, setEditForm] = useState<Partial<CatalogProduct>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Add product
  const [showAdd, setShowAdd] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', title: '', description: '', category: '', price_min: '', price_max: '', quantity: '', highlights: '', variants: '' });
  const [newImageFile, setNewImageFile] = useState<File | null>(null);

  // Fetch Pexels
  const [fetchingImage, setFetchingImage] = useState<string | null>(null);
  // Generate AI image
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);

  // Bulk generation
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentName: '', failed: 0 });
  const [bulkStopRef] = useState<{ stop: boolean }>({ stop: false });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const supabase = createClient();
    const [{ data: cats }, { data: prods }] = await Promise.all([
      supabase.from('catalog_categories').select('*').order('sort_order'),
      supabase.from('catalog_products').select('*').order('sort_order'),
    ]);
    const c = (cats as CatalogCategory[]) || [];
    setCategories(c);
    setProducts((prods as CatalogProduct[]) || []);
    if (c.length > 0 && !activeCategory) setActiveCategory(c[0].name);
    setLoading(false);
  };

  // Toggle category enabled
  const toggleCategory = async (cat: CatalogCategory) => {
    const supabase = createClient();
    const newEnabled = !cat.enabled;
    await supabase.from('catalog_categories').update({ enabled: newEnabled }).eq('id', cat.id);
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, enabled: newEnabled } : c));
  };

  // Filtered products
  const filtered = useMemo(() => {
    let list = products;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.title.toLowerCase().includes(q) || p.parent_category.toLowerCase().includes(q));
    } else if (activeCategory) {
      list = list.filter(p => p.parent_category === activeCategory);
    }
    return list;
  }, [products, activeCategory, search]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    products.forEach(p => { counts[p.parent_category] = (counts[p.parent_category] || 0) + 1; });
    return counts;
  }, [products]);

  // Upload image for catalog product
  const uploadCatalogImage = async (file: File, productId: string): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('product_id', productId);
    formData.append('bucket', 'product-images');
    try {
      // Use service role via our API
      const res = await fetch('/api/upload-catalog-image', { method: 'POST', body: formData });
      if (!res.ok) return null;
      const { url } = await res.json();
      return url || null;
    } catch { return null; }
  };

  // Fetch Pexels image
  const fetchPexelsImage = async (product: CatalogProduct) => {
    setFetchingImage(product.id);
    try {
      const query = product.pexels_query || `${product.name} ${product.parent_category} indian`;
      const res = await fetch(`/api/pexels-image?query=${encodeURIComponent(query)}`);
      const { url } = await res.json();
      if (url) {
        const supabase = createClient();
        await supabase.from('catalog_products').update({ image_url: url }).eq('id', product.id);
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, image_url: url } : p));
      }
    } catch {}
    setFetchingImage(null);
  };

  // Generate AI image (DALL-E 3)
  const generateAIImage = async (product: CatalogProduct) => {
    setGeneratingAI(product.id);
    try {
      const res = await fetch('/api/ai/generate-catalog-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, name: product.title || product.name, category: product.parent_category, description: product.description }),
      });
      const data = await res.json();
      if (data.url) {
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, image_url: data.url } : p));
      } else {
        alert(data.error || 'Failed to generate image');
      }
    } catch {
      alert('Failed to generate image');
    }
    setGeneratingAI(null);
  };

  // Bulk generate AI images for all products (or those missing images)
  const bulkGenerateImages = async (onlyMissing: boolean) => {
    const targets = onlyMissing ? products.filter(p => !p.image_url) : [...products];
    if (targets.length === 0) { alert('No products to generate images for.'); return; }
    if (!confirm(`Generate AI images for ${targets.length} products? This will take ~${Math.ceil(targets.length * 15 / 60)} minutes and cost ~$${(targets.length * 0.08).toFixed(2)}.`)) return;

    setBulkRunning(true);
    bulkStopRef.stop = false;
    setBulkProgress({ current: 0, total: targets.length, currentName: '', failed: 0 });
    let failed = 0;

    for (let i = 0; i < targets.length; i++) {
      if (bulkStopRef.stop) break;

      const product = targets[i];
      setBulkProgress(prev => ({ ...prev, current: i + 1, currentName: product.title || product.name }));
      setGeneratingAI(product.id);

      try {
        const res = await fetch('/api/ai/generate-catalog-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: product.id, name: product.title || product.name, category: product.parent_category, description: product.description }),
        });
        const data = await res.json();
        if (data.url) {
          setProducts(prev => prev.map(p => p.id === product.id ? { ...p, image_url: data.url } : p));
        } else {
          failed++;
          setBulkProgress(prev => ({ ...prev, failed }));
        }
      } catch {
        failed++;
        setBulkProgress(prev => ({ ...prev, failed }));
      }

      setGeneratingAI(null);

      // Wait 15 seconds between images to stay under rate limit (4/min)
      if (i < targets.length - 1 && !bulkStopRef.stop) {
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    }

    setBulkRunning(false);
    setGeneratingAI(null);
  };

  const stopBulkGeneration = () => {
    bulkStopRef.stop = true;
  };

  // Save edited product
  const saveProduct = async () => {
    if (!editingProduct) return;
    setSaving(true);
    const supabase = createClient();

    let imageUrl = editForm.image_url ?? editingProduct.image_url;
    if (imageFile) {
      const url = await uploadCatalogImage(imageFile, editingProduct.id);
      if (url) imageUrl = url;
    }

    const updates = {
      name: editForm.name || editingProduct.name,
      title: editForm.title || editingProduct.title,
      description: editForm.description ?? editingProduct.description,
      highlights: editForm.highlights ?? editingProduct.highlights,
      price_min: editForm.price_min ?? editingProduct.price_min,
      price_max: editForm.price_max ?? editingProduct.price_max,
      quantity: editForm.quantity ?? editingProduct.quantity,
      variants: editForm.variants ?? editingProduct.variants,
      ingredients: editForm.ingredients ?? editingProduct.ingredients,
      pexels_query: editForm.pexels_query ?? editingProduct.pexels_query,
      image_url: imageUrl,
    };

    await supabase.from('catalog_products').update(updates).eq('id', editingProduct.id);
    setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...updates } as CatalogProduct : p));
    setEditingProduct(null);
    setEditForm({});
    setImageFile(null);
    setSaving(false);
  };

  // Add new product
  const addProduct = async () => {
    if (!newProduct.name || !newProduct.title) return;
    setSaving(true);
    const supabase = createClient();

    const { data } = await supabase.from('catalog_products').insert({
      name: newProduct.name,
      title: newProduct.title,
      description: newProduct.description,
      category: newProduct.category,
      parent_category: activeCategory,
      highlights: newProduct.highlights,
      price_min: parseFloat(newProduct.price_min) || 0,
      price_max: parseFloat(newProduct.price_max) || 0,
      quantity: newProduct.quantity,
      variants: newProduct.variants ? newProduct.variants.split(',').map(v => v.trim()).filter(Boolean) : [],
      enabled: true,
      sort_order: products.length,
    }).select().single();

    if (data) {
      let finalProduct = data as CatalogProduct;
      if (newImageFile) {
        const url = await uploadCatalogImage(newImageFile, data.id);
        if (url) {
          await supabase.from('catalog_products').update({ image_url: url }).eq('id', data.id);
          finalProduct = { ...finalProduct, image_url: url };
        }
      }
      setProducts([...products, finalProduct]);
      setNewProduct({ name: '', title: '', description: '', category: '', price_min: '', price_max: '', quantity: '', highlights: '', variants: '' });
      setNewImageFile(null);
      setShowAdd(false);
    }
    setSaving(false);
  };

  // Delete product
  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this catalog product?')) return;
    const supabase = createClient();
    await supabase.from('catalog_products').delete().eq('id', id);
    setProducts(products.filter(p => p.id !== id));
  };

  // Toggle product enabled
  const toggleProduct = async (product: CatalogProduct) => {
    const supabase = createClient();
    const newEnabled = !product.enabled;
    await supabase.from('catalog_products').update({ enabled: newEnabled }).eq('id', product.id);
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, enabled: newEnabled } : p));
  };

  if (loading) return <div className="text-warm-gray py-12 text-center">Loading catalog...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display text-ink">Product Catalog</h1>
          <p className="text-sm text-warm-gray mt-1">
            {categories.length} categories · {products.length} products · {categories.filter(c => c.enabled).length} enabled
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="bg-white border border-border rounded-lg px-4 py-2 text-sm text-ink placeholder:text-warm-gray w-56 focus:outline-none focus:border-amber"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-2.5 text-warm-gray hover:text-ink text-sm">✕</button>
            )}
          </div>
          <button onClick={() => setShowAdd(true)} className="px-4 py-2 bg-amber text-white rounded-lg text-sm font-medium hover:bg-amber/90">+ Add Product</button>
        </div>
      </div>

      {/* Bulk AI Image Generation */}
      {bulkRunning ? (
        <div className="bg-purple-50 rounded-xl border border-purple-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="animate-pulse text-lg">✨</span>
              <span className="text-sm font-medium text-purple-900">
                Generating {bulkProgress.current} of {bulkProgress.total}: {bulkProgress.currentName}
              </span>
            </div>
            <button onClick={stopBulkGeneration} className="px-3 py-1 bg-rose-100 text-rose-700 text-xs font-medium rounded-lg hover:bg-rose-200">
              Stop
            </button>
          </div>
          <div className="w-full bg-purple-200 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-purple-700">
            <span>~{Math.ceil((bulkProgress.total - bulkProgress.current) * 15 / 60)} min remaining</span>
            {bulkProgress.failed > 0 && <span className="text-rose-600">{bulkProgress.failed} failed</span>}
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => bulkGenerateImages(true)}
            disabled={!!generatingAI}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            ✨ Generate Missing Images ({products.filter(p => !p.image_url).length})
          </button>
          <button
            onClick={() => bulkGenerateImages(false)}
            disabled={!!generatingAI}
            className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 disabled:opacity-50"
          >
            ✨ Regenerate All ({products.length})
          </button>
        </div>
      )}

      {/* Category tabs with enable/disable toggle */}
      {!search && (
        <div className="space-y-3 mb-6">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.name)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors border ${
                  activeCategory === cat.name
                    ? 'text-ink font-medium bg-amber/10 border-amber/30'
                    : cat.enabled
                    ? 'text-warm-gray hover:text-ink bg-white border-border'
                    : 'text-warm-gray/40 bg-gray-50 border-gray-200 line-through'
                }`}
              >
                <span>{cat.emoji}</span>
                {cat.name}
                <span className="text-[10px] opacity-60">({categoryCounts[cat.name] || 0})</span>
              </button>
            ))}
          </div>

          {/* Category toggle */}
          {activeCategory && (() => {
            const cat = categories.find(c => c.name === activeCategory);
            if (!cat) return null;
            return (
              <div className="flex items-center gap-3 bg-white rounded-xl border border-border px-4 py-3">
                <span className="text-lg">{cat.emoji}</span>
                <span className="text-sm text-ink font-medium flex-1">{cat.name}</span>
                <span className="text-xs text-warm-gray">{cat.enabled ? 'Visible to sellers' : 'Hidden from sellers'}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={cat.enabled} onChange={() => toggleCategory(cat)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-checked:bg-green-500 rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                </label>
              </div>
            );
          })()}
        </div>
      )}

      {search && (
        <div className="text-sm text-warm-gray mb-4">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} for &ldquo;{search}&rdquo;
        </div>
      )}

      {/* Add product form */}
      {showAdd && (
        <div className="bg-white rounded-xl border border-border p-5 mb-6">
          <h3 className="text-ink font-medium mb-3">New Catalog Product {activeCategory && <span className="text-warm-gray font-normal">in {activeCategory}</span>}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="text" placeholder="Product name" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} className="px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-amber" />
            <input type="text" placeholder="Display title" value={newProduct.title} onChange={e => setNewProduct({ ...newProduct, title: e.target.value })} className="px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-amber" />
            <input type="text" placeholder="Description" value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} className="px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-amber" />
            <input type="text" placeholder="Sub-category (e.g. Cake, Blouse)" value={newProduct.category} onChange={e => setNewProduct({ ...newProduct, category: e.target.value })} className="px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-amber" />
            <input type="number" placeholder="Min price (₹)" value={newProduct.price_min} onChange={e => setNewProduct({ ...newProduct, price_min: e.target.value })} className="px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-amber" />
            <input type="number" placeholder="Max price (₹)" value={newProduct.price_max} onChange={e => setNewProduct({ ...newProduct, price_max: e.target.value })} className="px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-amber" />
            <input type="text" placeholder="Quantity (e.g. 1 kg, Box of 6)" value={newProduct.quantity} onChange={e => setNewProduct({ ...newProduct, quantity: e.target.value })} className="px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-amber" />
            <input type="text" placeholder="Variants (comma-separated)" value={newProduct.variants} onChange={e => setNewProduct({ ...newProduct, variants: e.target.value })} className="px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-amber" />
            <label className="flex items-center gap-2 px-3 py-2.5 border border-border rounded-lg text-sm text-warm-gray cursor-pointer hover:border-amber">
              <span>{newImageFile ? newImageFile.name : 'Choose image...'}</span>
              <input type="file" accept="image/*" className="hidden" onChange={e => setNewImageFile(e.target.files?.[0] || null)} />
            </label>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addProduct} disabled={saving} className="px-4 py-2 bg-ink text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Adding...' : 'Add Product'}</button>
            <button onClick={() => { setShowAdd(false); setNewImageFile(null); }} className="px-4 py-2 text-warm-gray text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Products grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(product => (
          <div key={product.id} className={`bg-white rounded-xl border overflow-hidden ${product.enabled ? 'border-border' : 'border-border opacity-50'}`}>
            {/* Image */}
            <div className="h-40 bg-cream flex items-center justify-center relative group">
              {product.image_url ? (
                <>
                  <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  {/* Regenerate overlay on hover */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => generateAIImage(product)}
                      disabled={generatingAI === product.id}
                      className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {generatingAI === product.id ? '✨ Generating...' : '✨ AI Regen'}
                    </button>
                    <button
                      onClick={() => fetchPexelsImage(product)}
                      disabled={fetchingImage === product.id}
                      className="px-3 py-1.5 bg-white text-ink text-xs font-medium rounded-lg hover:bg-gray-100 disabled:opacity-50"
                    >
                      {fetchingImage === product.id ? 'Fetching...' : '📷 Pexels'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <button
                    onClick={() => generateAIImage(product)}
                    disabled={generatingAI === product.id}
                    className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {generatingAI === product.id ? <span className="animate-pulse">✨ Generating...</span> : '✨ Generate AI Image'}
                  </button>
                  <button
                    onClick={() => fetchPexelsImage(product)}
                    disabled={fetchingImage === product.id}
                    className="text-warm-gray hover:text-ink text-xs transition-colors"
                  >
                    {fetchingImage === product.id ? 'Fetching...' : 'or fetch from Pexels'}
                  </button>
                </div>
              )}
              <span className="absolute top-2 left-2 text-[10px] bg-white/90 text-ink px-2 py-0.5 rounded-full border border-border">
                {product.category}
              </span>
              {generatingAI === product.id && (
                <div className="absolute inset-0 bg-purple-900/60 flex items-center justify-center">
                  <div className="text-white text-sm font-medium animate-pulse">✨ Generating with DALL-E 3...</div>
                </div>
              )}
              {!product.enabled && (
                <span className="absolute top-2 right-2 text-[10px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full">HIDDEN</span>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="text-ink font-medium text-sm truncate">{product.title}</h3>
                  <p className="text-warm-gray text-xs mt-1 line-clamp-2">{product.description}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full">
                  ₹{product.price_min}–{product.price_max}
                </span>
                <span className="text-[10px] bg-cream text-warm-gray px-2 py-0.5 rounded-full">
                  {product.quantity}
                </span>
                {product.variants.length > 0 && (
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                    {product.variants.length} variants
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="mt-3 flex items-center gap-2 pt-3 border-t border-border">
                <button onClick={() => { setEditingProduct(product); setEditForm({ ...product }); setImageFile(null); }} className="text-xs text-amber hover:underline">Edit</button>
                <button onClick={() => toggleProduct(product)} className="text-xs text-warm-gray hover:text-ink">{product.enabled ? 'Hide' : 'Show'}</button>
                <button onClick={() => deleteProduct(product.id)} className="text-xs text-warm-gray hover:text-rose ml-auto">Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-warm-gray py-16 bg-white rounded-xl border border-border">No products found</div>
      )}

      {/* Edit modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setEditingProduct(null); setImageFile(null); }}>
          <div className="bg-white rounded-2xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="text-ink font-medium">Edit Catalog Product</h2>
              <button onClick={() => { setEditingProduct(null); setImageFile(null); }} className="text-warm-gray hover:text-ink">✕</button>
            </div>

            <div className="p-5 space-y-4">
              {/* Image */}
              {(imageFile || editingProduct.image_url) && (
                <div className="w-full h-40 rounded-xl overflow-hidden bg-cream">
                  <img src={imageFile ? URL.createObjectURL(imageFile) : editingProduct.image_url!} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <label className="flex items-center gap-2 px-3 py-2.5 border border-border rounded-lg text-sm text-warm-gray cursor-pointer hover:border-amber w-full">
                <span>{imageFile ? imageFile.name : 'Upload new image...'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => setImageFile(e.target.files?.[0] || null)} />
              </label>

              <div>
                <label className="text-xs text-warm-gray block mb-1">Title</label>
                <input value={editForm.title || ''} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber" />
              </div>
              <div>
                <label className="text-xs text-warm-gray block mb-1">Description</label>
                <textarea value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber resize-none" />
              </div>
              <div>
                <label className="text-xs text-warm-gray block mb-1">Highlights</label>
                <input value={editForm.highlights || ''} onChange={e => setEditForm(f => ({ ...f, highlights: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-warm-gray block mb-1">Min Price (₹)</label>
                  <input type="number" value={editForm.price_min ?? 0} onChange={e => setEditForm(f => ({ ...f, price_min: Number(e.target.value) }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber" />
                </div>
                <div>
                  <label className="text-xs text-warm-gray block mb-1">Max Price (₹)</label>
                  <input type="number" value={editForm.price_max ?? 0} onChange={e => setEditForm(f => ({ ...f, price_max: Number(e.target.value) }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber" />
                </div>
              </div>
              <div>
                <label className="text-xs text-warm-gray block mb-1">Quantity / Unit</label>
                <input value={editForm.quantity || ''} onChange={e => setEditForm(f => ({ ...f, quantity: e.target.value }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber" />
              </div>
              <div>
                <label className="text-xs text-warm-gray block mb-1">Variants (comma-separated)</label>
                <input value={(editForm.variants || []).join(', ')} onChange={e => setEditForm(f => ({ ...f, variants: e.target.value.split(',').map(v => v.trim()).filter(Boolean) }))} className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber" />
              </div>
              <div>
                <label className="text-xs text-warm-gray block mb-1">Ingredients / Materials</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(editForm.ingredients || '').split(',').map(s => s.trim()).filter(Boolean).map((ing, i) => (
                    <span key={i} className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-amber/10 border border-amber/20 rounded-full text-xs text-ink">
                      {ing}
                      <button onClick={() => {
                        const parts = (editForm.ingredients || '').split(',').map(s => s.trim()).filter(Boolean);
                        parts.splice(i, 1);
                        setEditForm(f => ({ ...f, ingredients: parts.join(', ') }));
                      }} className="text-warm-gray hover:text-rose ml-0.5 text-sm leading-none">&times;</button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber"
                  placeholder="Type and press Enter to add"
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim().replace(/,$/,'');
                      if (val) {
                        const current = (editForm.ingredients || '').split(',').map(s => s.trim()).filter(Boolean);
                        current.push(val);
                        setEditForm(f => ({ ...f, ingredients: current.join(', ') }));
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
              </div>
              <div>
                <label className="text-xs text-warm-gray block mb-1">Pexels Search Query</label>
                <input value={editForm.pexels_query || ''} onChange={e => setEditForm(f => ({ ...f, pexels_query: e.target.value }))} placeholder={`${editForm.name} indian`} className="w-full border border-border rounded-lg px-3 py-2 text-sm placeholder:text-warm-gray/40 focus:outline-none focus:border-amber" />
              </div>
            </div>

            <div className="p-5 border-t border-border flex gap-3 justify-end">
              <button onClick={() => { setEditingProduct(null); setImageFile(null); }} className="px-4 py-2 text-sm text-warm-gray hover:text-ink">Cancel</button>
              <button onClick={saveProduct} disabled={saving} className="px-4 py-2 bg-amber text-white text-sm font-medium rounded-lg hover:bg-amber/90 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
