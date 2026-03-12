'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  is_available: boolean;
  track_stock: boolean;
  stock_quantity: number | null;
  image_url: string | null;
  images: string[] | null;
  category: string | null;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [sellerId, setSellerId] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', currency: 'USD' });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: seller } = await supabase
      .from('sellers')
      .select('id, country')
      .eq('user_id', user.id)
      .single();

    if (!seller) return;
    setSellerId(seller.id);
    setNewProduct((p) => ({ ...p, currency: seller.country === 'india' ? 'INR' : 'USD' }));

    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('seller_id', seller.id)
      .order('sort_order');

    setProducts((data as Product[]) || []);
  };

  const toggleAvailability = async (product: Product) => {
    const supabase = createClient();
    await supabase.from('products').update({ is_available: !product.is_available }).eq('id', product.id);
    setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, is_available: !p.is_available } : p));
  };

  const adjustStock = async (product: Product, delta: number) => {
    const newQty = Math.max(0, (product.stock_quantity || 0) + delta);
    const supabase = createClient();
    await supabase.from('products').update({ stock_quantity: newQty }).eq('id', product.id);
    setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, stock_quantity: newQty } : p));
  };

  const addProduct = async () => {
    if (!newProduct.name || !newProduct.price) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('products')
      .insert({
        seller_id: sellerId,
        name: newProduct.name,
        description: newProduct.description || null,
        price: parseFloat(newProduct.price),
        currency: newProduct.currency,
        is_available: true,
        sort_order: products.length + 1,
      })
      .select()
      .single();

    if (data) {
      setProducts([...products, data as Product]);
      setNewProduct({ name: '', description: '', price: '', currency: newProduct.currency });
      setShowAdd(false);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    const supabase = createClient();
    await supabase.from('products').delete().eq('id', id);
    setProducts(products.filter((p) => p.id !== id));
  };

  const stockColor = (p: Product) => {
    if (!p.track_stock) return '';
    if ((p.stock_quantity || 0) === 0) return 'text-rose';
    if ((p.stock_quantity || 0) < 5) return 'text-amber';
    return 'text-green';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-ink">Products</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="px-5 py-2 bg-amber text-white rounded-lg font-semibold hover:bg-amber/90 transition-colors"
        >
          + Add Product
        </button>
      </div>

      {/* Add product form */}
      {showAdd && (
        <div className="bg-white rounded-xl p-6 border border-[#e7e0d4] mb-6">
          <h2 className="font-semibold text-ink mb-4">New Product</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Product name"
              value={newProduct.name}
              onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
              className="px-4 py-3 border border-[#e7e0d4] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newProduct.description}
              onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
              className="px-4 py-3 border border-[#e7e0d4] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber"
            />
            <input
              type="number"
              placeholder="Price"
              value={newProduct.price}
              onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
              className="px-4 py-3 border border-[#e7e0d4] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber"
            />
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={addProduct}
              className="px-5 py-2 bg-ink text-white rounded-lg font-semibold hover:bg-ink/90"
            >
              Save
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-5 py-2 text-warm-gray hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Products list */}
      {products.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-[#e7e0d4] text-center">
          <p className="text-warm-gray text-lg">No products yet. Add your first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <div key={product.id} className="bg-white rounded-xl p-5 border border-[#e7e0d4]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  {/* Product image */}
                  {(() => {
                    const img = product.images?.[0] || product.image_url;
                    return img ? (
                      <img src={img} alt={product.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-border" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-amber/10 flex items-center justify-center flex-shrink-0 text-xl">📦</div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-ink">{product.name}</h3>
                    <span className={`text-sm font-medium ${product.is_available ? 'text-green' : 'text-warm-gray'}`}>
                      {product.is_available ? 'Available' : 'Unavailable'}
                    </span>
                  </div>
                  {product.description && (
                    <p className="text-sm text-warm-gray mt-1">{product.description}</p>
                  )}
                  <p className="text-lg font-bold text-ink mt-1">
                    {product.currency === 'INR' ? '\u20B9' : '$'}{product.price}
                  </p>
                </div>
                </div>

                <div className="flex items-center gap-4">
                  {product.track_stock && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => adjustStock(product, -1)}
                        className="w-8 h-8 rounded-full border border-[#e7e0d4] flex items-center justify-center hover:bg-cream"
                      >
                        -
                      </button>
                      <span className={`font-bold min-w-[2rem] text-center ${stockColor(product)}`}>
                        {product.stock_quantity ?? 0}
                      </span>
                      <button
                        onClick={() => adjustStock(product, 1)}
                        className="w-8 h-8 rounded-full border border-[#e7e0d4] flex items-center justify-center hover:bg-cream"
                      >
                        +
                      </button>
                    </div>
                  )}

                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={product.is_available}
                      onChange={() => toggleAvailability(product)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#e7e0d4] peer-checked:bg-green rounded-full transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                  </label>

                  <button
                    onClick={() => deleteProduct(product.id)}
                    className="text-warm-gray hover:text-rose transition-colors text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
