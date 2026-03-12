'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UnroutedMessage {
  id: string;
  from_phone: string;
  message_text: string;
  reason: string;
  candidate_sellers: { id: string; name: string }[] | null;
  channel: string;
  assigned_seller_id: string | null;
  resolved: boolean;
  created_at: string;
}

interface Seller {
  id: string;
  business_name: string;
  slug: string;
}

export default function AdminUnrouted() {
  const [messages, setMessages] = useState<UnroutedMessage[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'unresolved' | 'resolved' | 'all'>('unresolved');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<string>('');

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      let query = supabase
        .from('unrouted_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (filter === 'unresolved') query = query.eq('resolved', false);
      if (filter === 'resolved') query = query.eq('resolved', true);

      const [{ data: msgs }, { data: sellerList }] = await Promise.all([
        query,
        supabase.from('sellers').select('id, business_name, slug').eq('status', 'active').order('business_name'),
      ]);

      setMessages(msgs || []);
      setSellers(sellerList || []);
      setLoading(false);
    };
    load();
  }, [filter]);

  const assignSeller = async (messageId: string, sellerId: string) => {
    const supabase = createClient();
    await supabase
      .from('unrouted_messages')
      .update({ assigned_seller_id: sellerId, resolved: true })
      .eq('id', messageId);

    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, assigned_seller_id: sellerId, resolved: true } : m
    ));
    setAssigning(null);
    setSelectedSeller('');
  };

  const markResolved = async (messageId: string) => {
    const supabase = createClient();
    await supabase
      .from('unrouted_messages')
      .update({ resolved: true })
      .eq('id', messageId);

    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, resolved: true } : m
    ));
  };

  const unresolvedCount = messages.filter(m => !m.resolved).length;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-display text-ink">Unrouted Messages</h1>
        {unresolvedCount > 0 && (
          <span className="bg-rose-50 text-rose-600 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            {unresolvedCount} pending
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['unresolved', 'resolved', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              filter === f ? 'bg-ink text-white' : 'text-warm-gray hover:text-ink bg-white border border-border'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-warm-gray py-12 text-center">Loading...</div>
      ) : messages.length === 0 ? (
        <div className="text-center text-warm-gray py-16 bg-white rounded-xl border border-border">
          {filter === 'unresolved' ? 'No unresolved messages' : 'No messages found'}
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(m => (
            <div key={m.id} className={`bg-white rounded-xl border p-4 ${
              m.resolved ? 'border-border opacity-60' : 'border-border'
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-ink font-mono text-sm">{m.from_phone}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      m.reason === 'no_match' ? 'bg-rose-50 text-rose-600' :
                      'bg-amber-50 text-amber-600'
                    }`}>
                      {m.reason === 'no_match' ? 'NO MATCH' : 'AMBIGUOUS'}
                    </span>
                    <span className="text-[10px] text-warm-gray">{m.channel}</span>
                    <span className="text-[10px] text-warm-gray">
                      {new Date(m.created_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                    {m.resolved && (
                      <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full">RESOLVED</span>
                    )}
                  </div>

                  {/* Message */}
                  <div className="text-sm text-ink bg-cream rounded-lg p-3 mb-2">
                    {m.message_text || '(no text)'}
                  </div>

                  {/* Candidate sellers */}
                  {m.candidate_sellers && m.candidate_sellers.length > 0 && (
                    <div className="mb-2">
                      <span className="text-[10px] text-warm-gray block mb-1">Candidates:</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {m.candidate_sellers.map(cs => (
                          <button
                            key={cs.id}
                            onClick={() => assignSeller(m.id, cs.id)}
                            className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            Assign → {cs.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {!m.resolved && (
                  <div className="flex flex-col gap-2 shrink-0">
                    {assigning === m.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedSeller}
                          onChange={(e) => setSelectedSeller(e.target.value)}
                          className="border border-border rounded-lg px-2 py-1.5 text-xs text-ink bg-white"
                        >
                          <option value="">Pick seller...</option>
                          {sellers.map(s => (
                            <option key={s.id} value={s.id}>{s.business_name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => selectedSeller && assignSeller(m.id, selectedSeller)}
                          disabled={!selectedSeller}
                          className="text-xs bg-amber text-white px-2.5 py-1.5 rounded-lg font-medium disabled:opacity-30"
                        >
                          Assign
                        </button>
                        <button
                          onClick={() => { setAssigning(null); setSelectedSeller(''); }}
                          className="text-xs text-warm-gray hover:text-ink"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setAssigning(m.id)}
                          className="text-xs bg-cream text-ink px-3 py-1.5 rounded-lg hover:bg-border border border-border"
                        >
                          Assign to seller
                        </button>
                        <button
                          onClick={() => markResolved(m.id)}
                          className="text-xs text-warm-gray hover:text-ink"
                        >
                          Dismiss
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
