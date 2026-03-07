'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const [seller, setSeller] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSeller();
  }, []);

  const loadSeller = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('sellers')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) setSeller(data);
  };

  const updateField = (field: string, value: string) => {
    setSeller({ ...seller, [field]: value });
    setSaved(false);
  };

  const save = async () => {
    if (!seller) return;
    setSaving(true);
    const supabase = createClient();

    await supabase
      .from('sellers')
      .update({
        business_name: seller.business_name,
        slug: seller.slug,
        description: seller.description,
        category: seller.category,
        city: seller.city,
        phone: seller.phone,
      })
      .eq('id', seller.id);

    setSaving(false);
    setSaved(true);
  };

  if (!seller) {
    return <div className="text-warm-gray">Loading...</div>;
  }

  return (
    <div>
      <h1 className="font-display text-3xl text-ink mb-6">Settings</h1>

      <div className="max-w-2xl space-y-6">
        {/* Business Profile */}
        <div className="bg-white rounded-xl p-6 border border-[#e7e0d4]">
          <h2 className="font-semibold text-ink mb-4">Business Profile</h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-ink block mb-1">Business Name</label>
              <input
                type="text"
                value={seller.business_name || ''}
                onChange={(e) => updateField('business_name', e.target.value)}
                className="w-full px-4 py-3 border border-[#e7e0d4] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-ink block mb-1">Booking Page URL</label>
              <div className="flex items-center">
                <span className="text-warm-gray text-sm mr-1">klovi.com/</span>
                <input
                  type="text"
                  value={seller.slug || ''}
                  onChange={(e) => updateField('slug', e.target.value)}
                  className="flex-1 px-4 py-3 border border-[#e7e0d4] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-ink block mb-1">Description</label>
              <textarea
                value={seller.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-[#e7e0d4] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-ink block mb-1">Category</label>
                <select
                  value={seller.category || ''}
                  onChange={(e) => updateField('category', e.target.value)}
                  className="w-full px-4 py-3 border border-[#e7e0d4] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber bg-white"
                >
                  <option value="food">Food & Snacks</option>
                  <option value="baking">Baking & Desserts</option>
                  <option value="jewelry">Jewelry & Accessories</option>
                  <option value="crafts">Arts & Crafts</option>
                  <option value="clothing">Clothing & Fashion</option>
                  <option value="beauty">Beauty & Skincare</option>
                  <option value="coaching">Coaching & Tutoring</option>
                  <option value="fitness">Fitness & Wellness</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-ink block mb-1">City</label>
                <input
                  type="text"
                  value={seller.city || ''}
                  onChange={(e) => updateField('city', e.target.value)}
                  className="w-full px-4 py-3 border border-[#e7e0d4] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-ink block mb-1">Phone</label>
              <input
                type="tel"
                value={seller.phone || ''}
                onChange={(e) => updateField('phone', e.target.value)}
                className="w-full px-4 py-3 border border-[#e7e0d4] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <button
              onClick={save}
              disabled={saving}
              className="px-6 py-3 bg-ink text-white rounded-lg font-semibold hover:bg-ink/90 disabled:opacity-50 min-h-[48px]"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {saved && <span className="text-green text-sm font-medium">Saved!</span>}
          </div>
        </div>

        {/* Plan Info */}
        <div className="bg-white rounded-xl p-6 border border-[#e7e0d4]">
          <h2 className="font-semibold text-ink mb-2">Your Plan</h2>
          <p className="text-ink capitalize text-lg font-bold">{seller.plan || 'Free'}</p>
          <p className="text-warm-gray text-sm mt-1">
            {seller.plan === 'free' && 'Upgrade to Growth for unlimited orders and AI messaging'}
            {seller.plan === 'growth' && 'Upgrade to Pro for AI Coach and Instagram auto-publishing'}
            {seller.plan === 'pro' && 'You have access to all features'}
          </p>
          {seller.plan !== 'pro' && (
            <a
              href="/pricing"
              className="inline-block mt-3 px-5 py-2 bg-amber text-white rounded-lg font-semibold hover:bg-amber/90"
            >
              Upgrade Plan
            </a>
          )}
        </div>

        {/* Booking Page Link */}
        <div className="bg-white rounded-xl p-6 border border-[#e7e0d4]">
          <h2 className="font-semibold text-ink mb-2">Your Booking Page</h2>
          {seller.slug ? (
            <div>
              <a
                href={`/${seller.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue hover:underline"
              >
                klovi.com/{seller.slug}
              </a>
              <p className="text-warm-gray text-sm mt-1">Share this link with your customers</p>
            </div>
          ) : (
            <p className="text-warm-gray">Set a slug above to get your booking page link</p>
          )}
        </div>
      </div>
    </div>
  );
}
