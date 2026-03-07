'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Broadcast = {
  id: string;
  title: string;
  message: string;
  segments: string[];
  channels: string[];
  status: string;
  total_recipients: number;
  delivered: number;
  sent_at: string | null;
  created_at: string;
};

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [segments, setSegments] = useState<string[]>(['all']);
  const [channels, setChannels] = useState<string[]>(['whatsapp']);
  const [sellerId, setSellerId] = useState('');

  useEffect(() => {
    loadBroadcasts();
  }, []);

  const loadBroadcasts = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: seller } = await supabase
      .from('sellers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!seller) return;
    setSellerId(seller.id);

    const { data } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: false });

    setBroadcasts((data as Broadcast[]) || []);
  };

  const createBroadcast = async () => {
    if (!title.trim() || !message.trim()) return;
    const supabase = createClient();

    const { data } = await supabase
      .from('broadcasts')
      .insert({
        seller_id: sellerId,
        title,
        message,
        segments,
        channels,
        status: 'draft',
      })
      .select()
      .single();

    if (data) {
      setBroadcasts([data as Broadcast, ...broadcasts]);
      setTitle('');
      setMessage('');
      setShowCompose(false);
    }
  };

  const toggle = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-ink">Broadcasts</h1>
        <button
          onClick={() => setShowCompose(true)}
          className="px-5 py-2 bg-amber text-white rounded-lg font-semibold hover:bg-amber/90"
        >
          + New Broadcast
        </button>
      </div>

      {showCompose && (
        <div className="bg-white rounded-xl p-6 border border-[#e7e0d4] mb-6">
          <h2 className="font-semibold text-ink mb-4">Compose Broadcast</h2>
          <input
            type="text"
            placeholder="Title (e.g., Weekend Special)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 border border-[#e7e0d4] rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-amber"
          />
          <textarea
            placeholder="Your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full px-4 py-3 border border-[#e7e0d4] rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-amber resize-none"
          />

          <div className="mb-4">
            <p className="text-sm font-semibold text-ink mb-2">Audience</p>
            <div className="flex gap-2">
              {['all', 'loyal', 'active', 'dormant', 'new'].map((seg) => (
                <button
                  key={seg}
                  onClick={() => toggle(segments, seg, setSegments)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                    segments.includes(seg) ? 'bg-ink text-white' : 'bg-cream text-warm-gray border border-[#e7e0d4]'
                  }`}
                >
                  {seg.charAt(0).toUpperCase() + seg.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm font-semibold text-ink mb-2">Channels</p>
            <div className="flex gap-2">
              {['whatsapp', 'sms', 'instagram'].map((ch) => (
                <button
                  key={ch}
                  onClick={() => toggle(channels, ch, setChannels)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                    channels.includes(ch) ? 'bg-ink text-white' : 'bg-cream text-warm-gray border border-[#e7e0d4]'
                  }`}
                >
                  {ch === 'whatsapp' ? 'WhatsApp' : ch === 'sms' ? 'SMS' : 'Instagram'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={createBroadcast} className="px-5 py-2 bg-ink text-white rounded-lg font-semibold hover:bg-ink/90">
              Save Draft
            </button>
            <button onClick={() => setShowCompose(false)} className="px-5 py-2 text-warm-gray hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      )}

      {broadcasts.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-[#e7e0d4] text-center">
          <p className="text-warm-gray text-lg">No broadcasts yet. Send your first promotion!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((b) => (
            <div key={b.id} className="bg-white rounded-xl p-5 border border-[#e7e0d4]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-ink">{b.title}</h3>
                <span className={`px-3 py-0.5 rounded-full text-xs font-semibold capitalize ${
                  b.status === 'sent' ? 'bg-green/10 text-green' : 'bg-amber/10 text-amber'
                }`}>
                  {b.status}
                </span>
              </div>
              <p className="text-sm text-warm-gray line-clamp-2">{b.message}</p>
              <div className="flex gap-4 mt-3 text-xs text-warm-gray">
                <span>{b.total_recipients} recipients</span>
                {b.delivered > 0 && <span>{b.delivered} delivered</span>}
                {b.sent_at && <span>Sent {new Date(b.sent_at).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
