'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Conversation = {
  id: string;
  channel: string;
  unread_count: number;
  last_message_at: string;
  customer: { name: string; phone?: string } | null;
};

type Message = {
  id: string;
  direction: string;
  body: string;
  sender_type: string;
  created_at: string;
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  instagram: 'Instagram',
  facebook: 'Facebook',
  web: 'Web',
};

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [reply, setReply] = useState('');
  const [sellerId, setSellerId] = useState('');

  useEffect(() => {
    loadConversations();
  }, []);

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
      .select('id, channel, unread_count, last_message_at, customer:customers(name, phone)')
      .eq('seller_id', seller.id)
      .order('last_message_at', { ascending: false })
      .limit(50);

    setConversations((data as unknown as Conversation[]) || []);
  };

  const selectConversation = async (conv: Conversation) => {
    setSelectedConv(conv);
    const supabase = createClient();

    const { data } = await supabase
      .from('messages')
      .select('id, direction, body, sender_type, created_at')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true })
      .limit(100);

    setMessages((data as Message[]) || []);

    // Mark as read
    if (conv.unread_count > 0) {
      await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conv.id);

      setConversations((prev) =>
        prev.map((c) => c.id === conv.id ? { ...c, unread_count: 0 } : c)
      );
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !selectedConv) return;
    const supabase = createClient();

    const { data: msg } = await supabase
      .from('messages')
      .insert({
        conversation_id: selectedConv.id,
        direction: 'outbound',
        sender_type: 'seller',
        body: reply,
        channel: selectedConv.channel,
        status: 'sent',
      })
      .select()
      .single();

    if (msg) {
      setMessages([...messages, msg as Message]);
      setReply('');
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-ink mb-6">Inbox</h1>

      <div className="bg-white rounded-xl border border-[#e7e0d4] overflow-hidden" style={{ height: '70vh' }}>
        <div className="flex h-full">
          {/* Conversation list */}
          <div className="w-80 border-r border-[#e7e0d4] overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center text-warm-gray">
                <p>No conversations yet</p>
                <p className="text-sm mt-1">Messages will appear here</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`w-full text-left p-4 border-b border-[#e7e0d4] hover:bg-cream/50 transition-colors ${
                    selectedConv?.id === conv.id ? 'bg-cream' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-ink truncate">
                      {conv.customer?.name || conv.customer?.phone || 'Unknown'}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="bg-amber text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-warm-gray">{CHANNEL_LABELS[conv.channel] || conv.channel}</span>
                    <span className="text-xs text-warm-gray">
                      {conv.last_message_at ? formatTime(conv.last_message_at) : ''}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 flex flex-col">
            {!selectedConv ? (
              <div className="flex-1 flex items-center justify-center text-warm-gray">
                Select a conversation to view messages
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="p-4 border-b border-[#e7e0d4]">
                  <p className="font-semibold text-ink">
                    {selectedConv.customer?.name || 'Unknown'}
                  </p>
                  <p className="text-xs text-warm-gray">
                    via {CHANNEL_LABELS[selectedConv.channel] || selectedConv.channel}
                  </p>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                          msg.direction === 'outbound'
                            ? 'bg-ink text-white rounded-br-md'
                            : 'bg-cream text-ink rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm">{msg.body}</p>
                        <p className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-white/60' : 'text-warm-gray'}`}>
                          {formatTime(msg.created_at)}
                          {msg.sender_type === 'ai' && ' (AI)'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Reply input */}
                <div className="p-4 border-t border-[#e7e0d4]">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                      placeholder="Type a message..."
                      className="flex-1 px-4 py-3 border border-[#e7e0d4] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber"
                    />
                    <button
                      onClick={sendReply}
                      disabled={!reply.trim()}
                      className="px-6 py-3 bg-ink text-white rounded-xl font-semibold hover:bg-ink/90 disabled:opacity-50 transition-colors"
                    >
                      Send
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
