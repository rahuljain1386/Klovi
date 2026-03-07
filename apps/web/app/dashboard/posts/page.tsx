'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Post = {
  id: string;
  template: string;
  post_type: string;
  caption: string;
  image_urls: string[];
  status: string;
  published_at: string | null;
  created_at: string;
};

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [template, setTemplate] = useState('announcement');
  const [postType, setPostType] = useState('feed');
  const [caption, setCaption] = useState('');
  const [generatingCaption, setGeneratingCaption] = useState(false);
  const [sellerId, setSellerId] = useState('');

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
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
      .from('posts')
      .select('*')
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: false });

    setPosts((data as Post[]) || []);
  };

  const generateCaption = async () => {
    setGeneratingCaption(true);
    try {
      const res = await fetch('/api/posts/generate-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      });
      const data = await res.json();
      if (data.caption) setCaption(data.caption);
    } catch {
      // ignore
    }
    setGeneratingCaption(false);
  };

  const createPost = async () => {
    if (!caption.trim()) return;
    const supabase = createClient();

    const { data } = await supabase
      .from('posts')
      .insert({
        seller_id: sellerId,
        template,
        post_type: postType,
        caption,
        image_urls: [],
        enhanced_image_urls: [],
        status: 'draft',
        ai_generated_caption: false,
        ai_suggested: false,
      })
      .select()
      .single();

    if (data) {
      setPosts([data as Post, ...posts]);
      setCaption('');
      setShowCreate(false);
    }
  };

  const TEMPLATES = [
    { id: 'announcement', label: 'Announcement' },
    { id: 'flash_sale', label: 'Flash Sale' },
    { id: 'seasonal', label: 'Seasonal' },
    { id: 'social_proof', label: 'Social Proof' },
    { id: 'restock', label: 'Restock Alert' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl text-ink">Posts</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2 bg-amber text-white rounded-lg font-semibold hover:bg-amber/90"
        >
          + Create Post
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl p-6 border border-[#e7e0d4] mb-6">
          <h2 className="font-semibold text-ink mb-4">New Post</h2>

          <div className="mb-4">
            <p className="text-sm font-semibold text-ink mb-2">Template</p>
            <div className="flex gap-2 flex-wrap">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                    template === t.id ? 'bg-ink text-white' : 'bg-cream text-warm-gray border border-[#e7e0d4]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm font-semibold text-ink mb-2">Post Type</p>
            <div className="flex gap-2">
              {['feed', 'carousel', 'story', 'reel'].map((pt) => (
                <button
                  key={pt}
                  onClick={() => setPostType(pt)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize ${
                    postType === pt ? 'bg-ink text-white' : 'bg-cream text-warm-gray border border-[#e7e0d4]'
                  }`}
                >
                  {pt}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-ink">Caption</p>
              <button
                onClick={generateCaption}
                disabled={generatingCaption}
                className="text-sm text-purple font-medium hover:text-purple/80 disabled:opacity-50"
              >
                {generatingCaption ? 'Generating...' : 'AI Generate'}
              </button>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your caption..."
              rows={5}
              className="w-full px-4 py-3 border border-[#e7e0d4] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={createPost} className="px-5 py-2 bg-ink text-white rounded-lg font-semibold hover:bg-ink/90">
              Save Draft
            </button>
            <button onClick={() => setShowCreate(false)} className="px-5 py-2 text-warm-gray hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-[#e7e0d4] text-center">
          <p className="text-warm-gray text-lg">No posts yet. Create your first social media post!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-xl p-5 border border-[#e7e0d4]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-warm-gray uppercase">{post.template.replace('_', ' ')}</span>
                <span className={`px-3 py-0.5 rounded-full text-xs font-semibold capitalize ${
                  post.status === 'published' ? 'bg-green/10 text-green' :
                  post.status === 'scheduled' ? 'bg-blue/10 text-blue' :
                  'bg-amber/10 text-amber'
                }`}>
                  {post.status}
                </span>
              </div>
              <p className="text-sm text-ink line-clamp-3">{post.caption}</p>
              <p className="text-xs text-warm-gray mt-3">
                {post.post_type} &middot; {new Date(post.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
