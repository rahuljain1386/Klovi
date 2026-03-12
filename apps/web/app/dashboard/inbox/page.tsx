'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

type Conversation = {
  id: string;
  channel: string;
  unread_count: number;
  last_message_at: string;
  last_message: string | null;
  needs_seller_attention: boolean;
  ai_can_handle: boolean;
  seller_id: string;
  customer: { id: string; name: string; phone?: string } | null;
};

type Message = {
  id: string;
  direction: string;
  body: string;
  role: string;
  sender_type: string;
  intent: string | null;
  confidence: number | null;
  created_at: string;
};

type UnroutedMessage = {
  id: string;
  from_phone: string;
  message_text: string;
  reason: string;
  candidate_sellers: { id: string; name: string }[] | null;
  resolved: boolean;
  created_at: string;
};

type SellerContext = {
  business_name: string;
  category: string;
  city: string;
  slug: string;
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: '💬 WhatsApp',
  sms: '📱 SMS',
  instagram: '📸 Instagram',
  facebook: '👍 Facebook',
  web: '🌐 Web',
};

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sellerId, setSellerId] = useState('');
  const [filter, setFilter] = useState<'all' | 'attention' | 'unrouted'>('all');
  const [unrouted, setUnrouted] = useState<UnroutedMessage[]>([]);
  const [sellerContext, setSellerContext] = useState<SellerContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    loadUnrouted();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!sellerId) return;
    const supabase = createClient();

    const channel = supabase
      .channel('inbox-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `seller_id=eq.${sellerId}`,
      }, (payload: any) => {
        const newMsg = payload.new as Message;
        // If it belongs to the currently selected conversation, add it
        if (selectedConv && newMsg && (payload.new as any).conversation_id === selectedConv.id) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
        // Refresh conversation list
        loadConversations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sellerId, selectedConv]);

  const loadConversations = async () => {
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
      .from('conversations')
      .select('id, channel, unread_count, last_message_at, last_message, needs_seller_attention, ai_can_handle, seller_id, customer:customers(id, name, phone)')
      .eq('seller_id', seller.id)
      .order('last_message_at', { ascending: false })
      .limit(100);

    setConversations((data as unknown as Conversation[]) || []);
  };

  const loadUnrouted = async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('unrouted_messages')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(50);

    setUnrouted((data as UnroutedMessage[]) || []);
  };

  const loadMessages = async (convId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('messages')
      .select('id, direction, body, role, sender_type, intent, confidence, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (data) setMessages(data as Message[]);
  };

  const loadSellerContext = async (sId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('sellers')
      .select('business_name, category, city, slug')
      .eq('id', sId)
      .single();
    setSellerContext(data as SellerContext | null);
  };

  const selectConversation = async (conv: Conversation) => {
    setSelectedConv(conv);
    await loadMessages(conv.id);
    await loadSellerContext(conv.seller_id);

    if (conv.unread_count > 0) {
      const supabase = createClient();
      await supabase
        .from('conversations')
        .update({ unread_count: 0, needs_seller_attention: false })
        .eq('id', conv.id);

      setConversations(prev =>
        prev.map(c => c.id === conv.id ? { ...c, unread_count: 0, needs_seller_attention: false } : c)
      );
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selectedConv || sending) return;
    setSending(true);

    const supabase = createClient();

    const { data: msg } = await supabase
      .from('messages')
      .insert({
        conversation_id: selectedConv.id,
        seller_id: sellerId,
        direction: 'outbound',
        role: 'seller',
        sender_type: 'seller',
        body: reply,
        channel: selectedConv.channel,
        status: 'sent',
      })
      .select()
      .single();

    if (msg) {
      setMessages(prev => [...prev, msg as Message]);
      setReply('');

      if (selectedConv.customer?.phone) {
        try {
          await fetch('/api/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: selectedConv.customer.phone,
              message: reply,
              channel: selectedConv.channel,
            }),
          });
        } catch (e) {
          console.error('Failed to send via channel:', e);
        }
      }

      await supabase
        .from('conversations')
        .update({ last_message: reply, last_message_at: new Date().toISOString() })
        .eq('id', selectedConv.id);
    }

    setSending(false);
  };

  const resolveUnrouted = async (msg: UnroutedMessage) => {
    const supabase = createClient();
    await supabase
      .from('unrouted_messages')
      .update({ resolved: true, assigned_seller_id: sellerId })
      .eq('id', msg.id);
    setUnrouted(prev => prev.filter(u => u.id !== msg.id));
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredConversations = filter === 'attention'
    ? conversations.filter(c => c.needs_seller_attention || c.unread_count > 0)
    : conversations;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-3xl text-ink">Inbox</h1>
        <div className="flex gap-2">
          <button onClick={() => setFilter('all')} className={`text-xs px-3 py-1.5 rounded-full font-semibold ${filter === 'all' ? 'bg-ink text-white' : 'bg-white text-warm-gray border border-border'}`}>
            All ({conversations.length})
          </button>
          <button onClick={() => setFilter('attention')} className={`text-xs px-3 py-1.5 rounded-full font-semibold ${filter === 'attention' ? 'bg-amber text-white' : 'bg-white text-warm-gray border border-border'}`}>
            Needs Reply ({conversations.filter(c => c.needs_seller_attention || c.unread_count > 0).length})
          </button>
          {unrouted.length > 0 && (
            <button onClick={() => setFilter('unrouted')} className={`text-xs px-3 py-1.5 rounded-full font-semibold ${filter === 'unrouted' ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
              ⚠️ Unrouted ({unrouted.length})
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border overflow-hidden" style={{ height: '75vh' }}>
        <div className="flex h-full">
          {/* Conversation list */}
          <div className="w-80 border-r border-border overflow-y-auto flex-shrink-0">
            {filter === 'unrouted' ? (
              /* Unrouted messages list */
              unrouted.length === 0 ? (
                <div className="p-8 text-center text-warm-gray">
                  <p>No unrouted messages</p>
                </div>
              ) : (
                unrouted.map(msg => (
                  <div key={msg.id} className="p-4 border-b border-border bg-rose-50/50">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ink text-sm">{msg.from_phone}</span>
                      <span className="text-[9px] bg-rose-100 text-rose-600 font-bold px-1.5 py-0.5 rounded">
                        {msg.reason === 'ambiguous_match' ? 'AMBIGUOUS' : 'NO MATCH'}
                      </span>
                    </div>
                    <p className="text-xs text-warm-gray mt-1 line-clamp-2">{msg.message_text}</p>
                    {msg.candidate_sellers && (
                      <div className="mt-2 space-y-1">
                        {msg.candidate_sellers.map((s, i) => (
                          <span key={i} className="text-[10px] bg-white px-2 py-0.5 rounded border border-border mr-1">{s.name}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-[10px] text-warm-gray">{formatTime(msg.created_at)}</span>
                      <button onClick={() => resolveUnrouted(msg)} className="text-[10px] text-amber font-semibold">Mark Resolved</button>
                    </div>
                  </div>
                ))
              )
            ) : (
              /* Regular conversations list */
              filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-warm-gray">
                  <p className="text-2xl mb-2">💬</p>
                  <p>No conversations yet</p>
                  <p className="text-sm mt-1">When customers message on WhatsApp, they&apos;ll appear here</p>
                </div>
              ) : (
                filteredConversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => selectConversation(conv)}
                    className={`w-full text-left p-4 border-b border-border hover:bg-cream/50 transition-colors ${
                      selectedConv?.id === conv.id ? 'bg-cream' : ''
                    } ${conv.needs_seller_attention ? 'bg-amber/5' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ink truncate text-sm">
                        {conv.customer?.name || conv.customer?.phone || 'Unknown'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {conv.needs_seller_attention && (
                          <span className="text-[9px] bg-amber/10 text-amber font-bold px-1.5 py-0.5 rounded">REPLY</span>
                        )}
                        {conv.unread_count > 0 && (
                          <span className="bg-amber text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                    {conv.last_message && (
                      <p className="text-xs text-warm-gray mt-1 truncate">{conv.last_message}</p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-warm-gray">{CHANNEL_LABELS[conv.channel] || conv.channel}</span>
                      <span className="text-[10px] text-warm-gray">
                        {conv.last_message_at ? formatTime(conv.last_message_at) : ''}
                      </span>
                    </div>
                  </button>
                ))
              )
            )}
          </div>

          {/* Messages + Context */}
          <div className="flex-1 flex flex-col">
            {!selectedConv ? (
              <div className="flex-1 flex flex-col items-center justify-center text-warm-gray gap-2">
                <span className="text-4xl">💬</span>
                <p>Select a conversation</p>
              </div>
            ) : (
              <>
                {/* Header with seller context */}
                <div className="p-4 border-b border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-ink">
                        {selectedConv.customer?.name || selectedConv.customer?.phone || 'Unknown'}
                      </p>
                      <p className="text-xs text-warm-gray">
                        {CHANNEL_LABELS[selectedConv.channel] || selectedConv.channel}
                        {selectedConv.customer?.phone && ` · ${selectedConv.customer.phone}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!selectedConv.ai_can_handle && (
                        <span className="text-[10px] bg-amber/10 text-amber font-bold px-2 py-1 rounded-full">AI paused</span>
                      )}
                    </div>
                  </div>

                  {/* Seller context panel */}
                  {sellerContext && (
                    <div className="mt-2 flex items-center gap-3 bg-cream/50 rounded-lg px-3 py-2">
                      <div className="text-[10px] text-warm-gray">
                        <span className="font-bold text-ink">Routed to:</span> {sellerContext.business_name}
                      </div>
                      <span className="text-[10px] text-warm-gray">·</span>
                      <span className="text-[10px] text-warm-gray">{sellerContext.category}</span>
                      <span className="text-[10px] text-warm-gray">·</span>
                      <span className="text-[10px] text-warm-gray">{sellerContext.city}</span>
                      <span className="text-[10px] text-warm-gray">·</span>
                      <span className="text-[10px] text-amber font-medium">klovi/{sellerContext.slug}</span>
                    </div>
                  )}
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map(msg => {
                    const isOutbound = msg.direction === 'outbound' || msg.role === 'assistant' || msg.role === 'seller';
                    const isAI = msg.role === 'assistant' || msg.sender_type === 'ai';
                    const isSeller = msg.role === 'seller' || msg.sender_type === 'seller';

                    return (
                      <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
                          isOutbound
                            ? isAI ? 'bg-blue-600 text-white rounded-br-md' : 'bg-ink text-white rounded-br-md'
                            : 'bg-cream text-ink rounded-bl-md'
                        }`}>
                          <p className="text-sm whitespace-pre-line">{msg.body}</p>
                          <div className={`flex items-center gap-1.5 mt-1 ${isOutbound ? 'text-white/50' : 'text-warm-gray'}`}>
                            <span className="text-[10px]">{formatTime(msg.created_at)}</span>
                            {isAI && <span className="text-[9px] bg-white/20 px-1 rounded">AI</span>}
                            {isSeller && <span className="text-[9px] bg-white/20 px-1 rounded">You</span>}
                            {msg.intent && <span className="text-[9px] bg-white/10 px-1 rounded">{msg.intent}</span>}
                            {msg.confidence != null && msg.confidence < 0.85 && (
                              <span className="text-[9px] bg-amber/30 px-1 rounded">low conf</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply input */}
                <div className="p-4 border-t border-border">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
                      placeholder="Type a reply..."
                      className="flex-1 px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-amber text-sm"
                    />
                    <button
                      onClick={sendReply}
                      disabled={!reply.trim() || sending}
                      className="px-6 py-3 bg-green text-white rounded-xl font-semibold hover:bg-green/90 disabled:opacity-50 transition-colors text-sm"
                    >
                      {sending ? '...' : 'Send'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
