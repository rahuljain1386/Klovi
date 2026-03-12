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
        <h1 className="text-2xl font-display text-white">Unrouted Messages</h1>
        {unresolvedCount > 0 && (
          <span className="bg-rose/20 text-rose text-xs font-semibold px-2.5 py-0.5 rounded-full">
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
              filter === f ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-white/40 py-12 text-center">Loading...</div>
      ) : messages.length === 0 ? (
        <div className="text-center text-white/30 py-16 bg-[#161822] rounded-xl border border-white/10">
          {filter === 'unresolved' ? 'No unresolved messages' : 'No messages found'}
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map(m => (
            <div key={m.id} className={`bg-[#161822] rounded-xl border p-4 ${
              m.resolved ? 'border-white/5 opacity-60' : 'border-white/10'
            }`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-white font-mono text-sm">{m.from_phone}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      m.reason === 'no_match' ? 'bg-rose/20 text-rose' :
                      'bg-amber/20 text-amber'
                    }`}>
                      {m.reason === 'no_match' ? 'NO MATCH' : 'AMBIGUOUS'}
                    </span>
                    <span className="text-[10px] text-white/20">{m.channel}</span>
                    <span className="text-[10px] text-white/20">
                      {new Date(m.created_at).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                    {m.resolved && (
                      <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">RESOLVED</span>
                    )}
                  </div>

                  {/* Message */}
                  <div className="text-sm text-white/70 bg-white/5 rounded-lg p-3 mb-2">
                    {m.message_text || '(no text)'}
                  </div>

                  {/* Candidate sellers */}
                  {m.candidate_sellers && m.candidate_sellers.length > 0 && (
                    <div className="mb-2">
                      <span className="text-[10px] text-white/30 block mb-1">Candidates:</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {m.candidate_sellers.map(cs => (
                          <button
                            key={cs.id}
                            onClick={() => assignSeller(m.id, cs.id)}
                            className="text-xs bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-lg hover:bg-blue-500/20 transition-colors"
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
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                        >
                          <option value="">Pick seller...</option>
                          {sellers.map(s => (
                            <option key={s.id} value={s.id}>{s.business_name}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => selectedSeller && assignSeller(m.id, selectedSeller)}
                          disabled={!selectedSeller}
                          className="text-xs bg-amber text-ink px-2.5 py-1.5 rounded-lg font-medium disabled:opacity-30"
                        >
                          Assign
                        </button>
                        <button
                          onClick={() => { setAssigning(null); setSelectedSeller(''); }}
                          className="text-xs text-white/30 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setAssigning(m.id)}
                          className="text-xs bg-white/5 text-white/60 px-3 py-1.5 rounded-lg hover:bg-white/10"
                        >
                          Assign to seller
                        </button>
                        <button
                          onClick={() => markResolved(m.id)}
                          className="text-xs text-white/30 hover:text-white/60"
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
