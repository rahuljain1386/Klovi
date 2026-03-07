'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function InterestForm({ pageId }: { pageId: string }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    setLoading(true);
    const supabase = createClient();
    await supabase.from('interest_signups').insert({ interest_page_id: pageId, name: name.trim(), phone: phone.trim() });
    setSubmitted(true);
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="bg-green-500/20 border border-green-400/30 rounded-2xl p-6 text-center">
        <div className="text-3xl mb-2">🎉</div>
        <p className="text-lg font-semibold text-green-300 mb-1">You&apos;re on the list!</p>
        <p className="text-sm text-green-200/70">We&apos;ll message you on WhatsApp when orders open.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input type="text" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white/10 border border-purple-400/30 rounded-xl px-4 py-3 text-sm placeholder-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50" required />
      <input type="tel" placeholder="WhatsApp number" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-white/10 border border-purple-400/30 rounded-xl px-4 py-3 text-sm placeholder-purple-400/50 focus:outline-none focus:ring-2 focus:ring-purple-400/50" required />
      <button type="submit" disabled={loading} className="w-full bg-purple-500 hover:bg-purple-400 text-white py-3.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50">{loading ? 'Signing up...' : 'Notify me when it launches'}</button>
      <p className="text-xs text-purple-400/60 text-center">No spam ever.</p>
    </form>
  );
}
