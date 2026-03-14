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

  const updateField = (field: string, value: any) => {
    setSeller({ ...seller, [field]: value });
    setSaved(false);
  };

  const toggleFulfillment = (mode: string) => {
    const current: string[] = seller.fulfillment_modes || [];
    let updated: string[];
    if (current.includes(mode)) {
      updated = current.filter((m: string) => m !== mode);
      // Don't allow empty — keep at least one
      if (updated.length === 0) return;
    } else {
      updated = [...current, mode];
    }
    updateField('fulfillment_modes', updated);
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
        whatsapp_number: seller.whatsapp_number,
        instagram_handle: seller.instagram_handle,
        facebook_handle: seller.facebook_handle,
        cod_enabled: seller.cod_enabled,
        upi_id: seller.upi_id,
        fulfillment_modes: seller.fulfillment_modes,
        pickup_address: seller.pickup_address,
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

        </div>

        {/* WhatsApp & Channels */}
        <div className="bg-white rounded-xl p-6 border border-[#e7e0d4]">
          <h2 className="font-semibold text-ink mb-4">WhatsApp & Channels</h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-ink block mb-1">WhatsApp Number</label>
              <input
                type="tel"
                value={seller.whatsapp_number || ''}
                onChange={(e) => updateField('whatsapp_number', e.target.value)}
                placeholder="e.g., +91 98765 43210"
                className="w-full px-4 py-3 border border-[#e7e0d4] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-ink block mb-1">Instagram Handle</label>
              <div className="flex items-center">
                <span className="text-warm-gray text-sm mr-1">@</span>
                <input
                  type="text"
                  value={seller.instagram_handle || ''}
                  onChange={(e) => updateField('instagram_handle', e.target.value)}
                  placeholder="yourhandle"
                  className="flex-1 px-4 py-3 border border-[#e7e0d4] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-ink block mb-1">Facebook Page</label>
              <input
                type="text"
                value={seller.facebook_handle || ''}
                onChange={(e) => updateField('facebook_handle', e.target.value)}
                placeholder="e.g., facebook.com/yourpage"
                className="w-full px-4 py-3 border border-[#e7e0d4] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber"
              />
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-xl p-6 border border-[#e7e0d4]">
          <h2 className="font-semibold text-ink mb-4">Payment Methods</h2>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={seller.cod_enabled || false}
                onChange={(e) => updateField('cod_enabled', e.target.checked)}
                className="w-5 h-5 rounded border-[#e7e0d4] text-amber focus:ring-amber"
              />
              <span className="text-ink font-medium">Cash on Delivery</span>
            </label>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!(seller.upi_id)}
                  onChange={(e) => {
                    if (!e.target.checked) updateField('upi_id', '');
                    else if (!seller.upi_id) updateField('upi_id', ' ');
                  }}
                  className="w-5 h-5 rounded border-[#e7e0d4] text-amber focus:ring-amber"
                />
                <span className="text-ink font-medium">UPI / Google Pay</span>
              </label>
              {seller.upi_id !== undefined && seller.upi_id !== null && seller.upi_id !== '' && (
                <div className="mt-2 ml-8">
                  <label className="text-sm font-medium text-ink block mb-1">UPI ID</label>
                  <input
                    type="text"
                    value={(seller.upi_id || '').trim()}
                    onChange={(e) => updateField('upi_id', e.target.value)}
                    placeholder="e.g., yourname@upi"
                    className="w-full px-4 py-3 border border-[#e7e0d4] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber"
                  />
                </div>
              )}
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!seller.stripe_account_id}
                disabled
                className="w-5 h-5 rounded border-[#e7e0d4] text-amber focus:ring-amber disabled:opacity-50"
              />
              <span className="text-ink font-medium">Online Payment (Stripe)</span>
              {!seller.stripe_account_id && (
                <span className="text-warm-gray text-sm">— not connected</span>
              )}
              {seller.stripe_account_id && (
                <span className="text-green text-sm">Connected</span>
              )}
            </label>
          </div>
        </div>

        {/* Fulfillment & Address */}
        <div className="bg-white rounded-xl p-6 border border-[#e7e0d4]">
          <h2 className="font-semibold text-ink mb-4">Fulfillment & Address</h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-ink block mb-2">How do customers get their orders?</label>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: 'pickup', label: 'Pickup' },
                  { value: 'delivery', label: 'Delivery' },
                ].map((option) => (
                  <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(seller.fulfillment_modes || []).includes(option.value)}
                      onChange={() => toggleFulfillment(option.value)}
                      className="w-5 h-5 rounded border-[#e7e0d4] text-amber focus:ring-amber"
                    />
                    <span className="text-ink font-medium">{option.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-warm-gray text-sm mt-1">Select one or both</p>
            </div>

            {(seller.fulfillment_modes || []).includes('pickup') && (
              <div>
                <label className="text-sm font-medium text-ink block mb-1">Pickup Address</label>
                <textarea
                  value={seller.pickup_address || ''}
                  onChange={(e) => updateField('pickup_address', e.target.value)}
                  rows={3}
                  placeholder="Enter the address where customers will pick up orders"
                  className="w-full px-4 py-3 border border-[#e7e0d4] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber resize-none"
                />
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex items-center gap-4">
          <button
            onClick={save}
            disabled={saving}
            className="px-6 py-3 bg-ink text-white rounded-lg font-semibold hover:bg-ink/90 disabled:opacity-50 min-h-[48px]"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {saved && <span className="text-green text-sm font-medium">Saved!</span>}
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
