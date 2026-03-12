'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface Seller {
  id: string;
  business_name: string;
  slug: string;
  category: string;
  city: string;
  country: string;
  phone: string;
  status: string;
  plan: string;
  total_orders: number;
  total_revenue: number;
  average_rating: number;
  created_at: string;
  whatsapp_number: string | null;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  status: string;
  images: string[] | null;
  category: string | null;
}

export default function AdminSellers() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'onboarding' | 'paused'>('all');
  // Product editing
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [editingSellerName, setEditingSellerName] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  // Add product
  const [showAdd, setShowAdd] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', currency: 'INR' });
  const [newImageFile, setNewImageFile] = useState<File | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      let query = supabase
        .from('sellers')
        .select('id, business_name, slug, category, city, country, phone, status, plan, total_orders, total_revenue, average_rating, created_at, whatsapp_number')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data } = await query;
      setSellers(data || []);
      setLoading(false);
    };
    load();
  }, [filter]);

  const loadProducts = async (sellerId: string, sellerName: string) => {
    setEditingSellerId(sellerId);
    setEditingSellerName(sellerName);
    setProductsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('products')
      .select('id, name, description, price, currency, status, images, category')
      .eq('seller_id', sellerId)
      .order('sort_order');
    setProducts((data as Product[]) || []);
    setProductsLoading(false);
  };

  const uploadImage = async (file: File, productId: string): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('product_id', productId);
    try {
      const res = await fetch('/api/upload-product-image', { method: 'POST', body: formData });
      if (!res.ok) return null;
      const { url } = await res.json();
      return url || null;
    } catch { return null; }
  };

  const saveProduct = async () => {
    if (!editingProduct) return;
    setSaving(true);
    const supabase = createClient();

    let images = editForm.images || editingProduct.images;
    if (imageFile) {
      const url = await uploadImage(imageFile, editingProduct.id);
      if (url) images = [url];
    }

    await supabase.from('products').update({
      name: editForm.name || editingProduct.name,
      description: editForm.description ?? editingProduct.description,
      price: editForm.price || editingProduct.price,
      images,
    }).eq('id', editingProduct.id);

    setProducts(prev => prev.map(p =>
      p.id === editingProduct.id ? { ...p, ...editForm, images } as Product : p
    ));
    setEditingProduct(null);
    setEditForm({});
    setImageFile(null);
    setSaving(false);
  };

  const addProduct = async () => {
    if (!newProduct.name || !newProduct.price || !editingSellerId) return;
    setSaving(true);
    const supabase = createClient();

    const { data } = await supabase
      .from('products')
      .insert({
        seller_id: editingSellerId,
        name: newProduct.name,
        description: newProduct.description || null,
        price: parseFloat(newProduct.price),
        currency: newProduct.currency,
        status: 'active',
        sort_order: products.length + 1,
      })
      .select('id, name, description, price, currency, status, images, category')
      .single();

    if (data) {
      let finalProduct = data as Product;
      if (newImageFile) {
        const url = await uploadImage(newImageFile, data.id);
        if (url) {
          await supabase.from('products').update({ images: [url] }).eq('id', data.id);
          finalProduct = { ...finalProduct, images: [url] };
        }
      }
      setProducts([...products, finalProduct]);
      setNewProduct({ name: '', description: '', price: '', currency: newProduct.currency });
      setNewImageFile(null);
      setShowAdd(false);
    }
    setSaving(false);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    const supabase = createClient();
    await supabase.from('products').delete().eq('id', id);
    setProducts(products.filter(p => p.id !== id));
  };

  const statusCounts = sellers.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <h1 className="text-2xl font-display text-ink mb-6">All Sellers</h1>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['all', 'active', 'onboarding', 'paused'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              filter === f ? 'bg-ink text-white' : 'text-warm-gray hover:text-ink bg-white border border-border'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="text-[10px] ml-1 opacity-50">
              ({f === 'all' ? sellers.length : (statusCounts[f] || 0)})
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-warm-gray py-12 text-center">Loading sellers...</div>
      ) : sellers.length === 0 ? (
        <div className="text-center text-warm-gray py-16 bg-white rounded-xl border border-border">
          No sellers yet. Share the onboarding link to get started.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="text-[11px] text-warm-gray font-medium px-4 py-3">SELLER</th>
                  <th className="text-[11px] text-warm-gray font-medium px-4 py-3">CATEGORY</th>
                  <th className="text-[11px] text-warm-gray font-medium px-4 py-3">LOCATION</th>
                  <th className="text-[11px] text-warm-gray font-medium px-4 py-3">STATUS</th>
                  <th className="text-[11px] text-warm-gray font-medium px-4 py-3">PLAN</th>
                  <th className="text-[11px] text-warm-gray font-medium px-4 py-3 text-right">ORDERS</th>
                  <th className="text-[11px] text-warm-gray font-medium px-4 py-3 text-right">REVENUE</th>
                  <th className="text-[11px] text-warm-gray font-medium px-4 py-3">JOINED</th>
                  <th className="text-[11px] text-warm-gray font-medium px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sellers.map(s => (
                  <tr key={s.id} className="hover:bg-cream/50">
                    <td className="px-4 py-3">
                      <div className="text-sm text-ink font-medium">{s.business_name}</div>
                      <div className="text-[10px] text-warm-gray">/{s.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-warm-gray">{s.category}</td>
                    <td className="px-4 py-3 text-xs text-warm-gray">{s.city}, {s.country?.toUpperCase()}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        s.status === 'active' ? 'bg-green-50 text-green-600' :
                        s.status === 'onboarding' ? 'bg-amber-50 text-amber-600' :
                        s.status === 'paused' ? 'bg-gray-100 text-gray-400' :
                        'bg-rose-50 text-rose-600'
                      }`}>
                        {s.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-warm-gray">{s.plan}</td>
                    <td className="px-4 py-3 text-sm text-ink text-right">{s.total_orders}</td>
                    <td className="px-4 py-3 text-sm text-ink text-right">₹{(s.total_revenue || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-[10px] text-warm-gray">
                      {new Date(s.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadProducts(s.id, s.business_name)}
                          className="text-xs text-amber hover:underline"
                        >
                          Products
                        </button>
                        <Link
                          href={`/${s.slug}`}
                          target="_blank"
                          className="text-xs text-warm-gray hover:text-ink"
                        >
                          View ↗
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Product editing panel */}
      {editingSellerId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => { setEditingSellerId(null); setEditingProduct(null); setShowAdd(false); }}>
          <div className="bg-white rounded-2xl border border-border w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
              <div>
                <h2 className="text-ink font-display text-lg">{editingSellerName}</h2>
                <p className="text-xs text-warm-gray">{products.length} products</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAdd(true)} className="text-xs bg-amber text-white px-3 py-1.5 rounded-lg font-medium hover:bg-amber/90">+ Add Product</button>
                <button onClick={() => { setEditingSellerId(null); setEditingProduct(null); setShowAdd(false); }} className="text-warm-gray hover:text-ink text-lg px-2">✕</button>
              </div>
            </div>

            {/* Add product form */}
            {showAdd && (
              <div className="p-5 border-b border-border bg-cream/50">
                <h3 className="text-sm font-medium text-ink mb-3">New Product</h3>
                <div className="space-y-3">
                  <input type="text" placeholder="Product name" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-amber" />
                  <input type="text" placeholder="Description (optional)" value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-amber" />
                  <div className="flex gap-3">
                    <input type="number" placeholder="Price" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} className="flex-1 px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-amber" />
                    <label className="flex-1 flex items-center gap-2 px-3 py-2.5 border border-border rounded-lg text-sm text-warm-gray cursor-pointer hover:border-amber">
                      <span>{newImageFile ? newImageFile.name : 'Choose image...'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={e => setNewImageFile(e.target.files?.[0] || null)} />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addProduct} disabled={saving} className="px-4 py-2 bg-ink text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? 'Saving...' : 'Add Product'}</button>
                    <button onClick={() => { setShowAdd(false); setNewImageFile(null); }} className="px-4 py-2 text-warm-gray text-sm">Cancel</button>
                  </div>
                </div>
              </div>
            )}

            <div className="p-5">
              {productsLoading ? (
                <div className="text-warm-gray text-center py-8">Loading products...</div>
              ) : products.length === 0 ? (
                <div className="text-warm-gray text-center py-8">No products yet</div>
              ) : (
                <div className="space-y-2">
                  {products.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-cream/30">
                      {/* Image */}
                      {p.images?.[0] ? (
                        <img src={p.images[0]} alt={p.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-amber/10 flex items-center justify-center flex-shrink-0 text-lg">📦</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-ink font-medium truncate">{p.name}</div>
                        {p.description && <div className="text-xs text-warm-gray truncate">{p.description}</div>}
                        <div className="text-sm font-bold text-amber mt-0.5">{p.currency === 'INR' ? '₹' : '$'}{p.price}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => { setEditingProduct(p); setEditForm({ ...p }); setImageFile(null); }} className="text-xs text-amber hover:underline">Edit</button>
                        <button onClick={() => deleteProduct(p.id)} className="text-xs text-warm-gray hover:text-rose">Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit product modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => { setEditingProduct(null); setImageFile(null); }}>
          <div className="bg-white rounded-2xl border border-border w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="text-ink font-medium">Edit Product</h3>
              <button onClick={() => { setEditingProduct(null); setImageFile(null); }} className="text-warm-gray hover:text-ink">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Current image */}
              {(imageFile || editingProduct.images?.[0]) && (
                <div className="w-full h-40 rounded-xl overflow-hidden bg-cream">
                  <img
                    src={imageFile ? URL.createObjectURL(imageFile) : editingProduct.images![0]}
                    alt={editingProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 px-3 py-2.5 border border-border rounded-lg text-sm text-warm-gray cursor-pointer hover:border-amber w-full">
                <span>{imageFile ? imageFile.name : 'Choose new image...'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={e => setImageFile(e.target.files?.[0] || null)} />
              </label>
              <div>
                <label className="text-xs text-warm-gray block mb-1">Name</label>
                <input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-amber" />
              </div>
              <div>
                <label className="text-xs text-warm-gray block mb-1">Description</label>
                <textarea value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-amber resize-none" />
              </div>
              <div>
                <label className="text-xs text-warm-gray block mb-1">Price</label>
                <input type="number" value={editForm.price || 0} onChange={e => setEditForm(f => ({ ...f, price: Number(e.target.value) }))} className="w-full px-3 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:border-amber" />
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
