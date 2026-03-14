'use client';

import { useEffect, useState, useRef } from 'react';
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
  const [businessName, setBusinessName] = useState('');
  const [businessType, setBusinessType] = useState('');

  // Image state
  const [postImage, setPostImage] = useState<string | null>(null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit/delete
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: seller } = await supabase
      .from('sellers')
      .select('id, business_name, category')
      .eq('user_id', user.id)
      .single();

    if (!seller) return;
    setSellerId(seller.id);
    setBusinessName(seller.business_name || '');
    setBusinessType(seller.category || '');

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
        body: JSON.stringify({ template, businessName, businessType }),
      });
      const data = await res.json();
      if (data.caption) setCaption(data.caption);
    } catch {
      // ignore
    }
    setGeneratingCaption(false);
  };

  const generatePostImage = async () => {
    if (!caption.trim() && !template) return;
    setGeneratingImage(true);
    try {
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${template.replace('_', ' ')} post for ${businessName}`,
          category: businessType,
        }),
      });
      const data = await res.json();
      if (data.image) {
        setPostImage(data.image);
      } else {
        alert(data.error || 'Failed to generate image');
      }
    } catch {
      alert('Failed to generate image');
    }
    setGeneratingImage(false);
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPostImage(e.target?.result as string);
      setUploadingImage(false);
    };
    reader.readAsDataURL(file);
  };

  const createPost = async () => {
    if (!caption.trim()) return;
    const supabase = createClient();

    const imageUrls = postImage ? [postImage] : [];

    const { data } = await supabase
      .from('posts')
      .insert({
        seller_id: sellerId,
        template,
        post_type: postType,
        caption,
        image_urls: imageUrls,
        enhanced_image_urls: [],
        status: 'draft',
        ai_generated_caption: false,
        ai_suggested: false,
      })
      .select()
      .single();

    if (data) {
      setPosts([data as Post, ...posts]);
      resetForm();
    }
  };

  const deletePost = async (id: string) => {
    if (!confirm('Delete this post?')) return;
    const supabase = createClient();
    await supabase.from('posts').delete().eq('id', id);
    setPosts(posts.filter(p => p.id !== id));
  };

  const resetForm = () => {
    setCaption('');
    setPostImage(null);
    setShowCreate(false);
    setTemplate('announcement');
    setPostType('feed');
  };

  const copyCaption = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const sharePost = (post: Post) => {
    const shopUrl = `https://kloviapp.com`;
    const text = `${post.caption}\n\nShop: ${shopUrl}`;
    if (navigator.share) {
      navigator.share({ text, title: businessName });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const TEMPLATES = [
    { id: 'announcement', label: 'Announcement', emoji: '📢' },
    { id: 'flash_sale', label: 'Flash Sale', emoji: '⚡' },
    { id: 'seasonal', label: 'Seasonal', emoji: '🎉' },
    { id: 'social_proof', label: 'Social Proof', emoji: '⭐' },
    { id: 'restock', label: 'Restock Alert', emoji: '📦' },
    { id: 'event', label: 'Event / Offer', emoji: '🎁' },
    { id: 'new_product', label: 'New Product', emoji: '✨' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl md:text-3xl text-ink">Posts</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="px-5 py-2 bg-amber text-white rounded-lg font-semibold hover:bg-amber/90 text-sm"
        >
          + Create Post
        </button>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl p-5 md:p-6 border border-[#e7e0d4] mb-6">
          <h2 className="font-semibold text-ink mb-4">New Post</h2>

          {/* Template */}
          <div className="mb-4">
            <p className="text-sm font-semibold text-ink mb-2">Template</p>
            <div className="flex gap-2 flex-wrap">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                    template === t.id ? 'bg-ink text-white' : 'bg-cream text-warm-gray border border-[#e7e0d4]'
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Post Type */}
          <div className="mb-4">
            <p className="text-sm font-semibold text-ink mb-2">Post Type</p>
            <div className="flex gap-2 flex-wrap">
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

          {/* Image */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-ink">Image</p>
              <div className="flex gap-2">
                <button
                  onClick={generatePostImage}
                  disabled={generatingImage}
                  className="text-sm text-purple-600 font-medium hover:text-purple-500 disabled:opacity-50"
                >
                  {generatingImage ? 'Generating...' : '✨ AI Generate'}
                </button>
              </div>
            </div>

            {postImage ? (
              <div className="relative rounded-xl overflow-hidden mb-2">
                <img src={postImage} alt="Post" className="w-full h-48 md:h-64 object-cover rounded-xl" />
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={generatePostImage}
                    disabled={generatingImage}
                    className="px-2 py-1 bg-purple-600 text-white text-xs rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {generatingImage ? '...' : '✨ Regenerate'}
                  </button>
                  <button
                    onClick={() => setPostImage(null)}
                    className="px-2 py-1 bg-black/50 text-white text-xs rounded-lg hover:bg-black/70"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#e7e0d4] rounded-xl p-8 text-center cursor-pointer hover:border-amber transition-colors"
              >
                <p className="text-warm-gray text-sm">
                  {uploadingImage ? 'Uploading...' : 'Click to upload image or use AI Generate above'}
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
            />
          </div>

          {/* Caption */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-ink">Caption</p>
              <button
                onClick={generateCaption}
                disabled={generatingCaption}
                className="text-sm text-purple-600 font-medium hover:text-purple-500 disabled:opacity-50"
              >
                {generatingCaption ? 'Generating...' : '✨ AI Caption'}
              </button>
            </div>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your caption..."
              rows={4}
              className="w-full px-4 py-3 border border-[#e7e0d4] rounded-lg focus:outline-none focus:ring-2 focus:ring-amber resize-none text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={createPost} className="px-5 py-2.5 bg-ink text-white rounded-lg font-semibold hover:bg-ink/90 text-sm">
              Save Draft
            </button>
            <button onClick={resetForm} className="px-5 py-2.5 text-warm-gray hover:text-ink text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-[#e7e0d4] text-center">
          <p className="text-warm-gray">No posts yet.</p>
          <p className="text-warm-gray text-sm mt-1">Create your first social media post!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-xl border border-[#e7e0d4] overflow-hidden">
              {/* Post image */}
              {post.image_urls?.[0] && (
                <img src={post.image_urls[0]} alt="" className="w-full h-40 object-cover" />
              )}
              <div className="p-4">
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
                <p className="text-xs text-warm-gray mt-2">
                  {post.post_type} &middot; {new Date(post.created_at).toLocaleDateString()}
                </p>
                {/* Actions */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-[#e7e0d4]">
                  <button
                    onClick={() => copyCaption(post.caption)}
                    className="text-xs text-amber font-medium hover:underline"
                  >
                    Copy Caption
                  </button>
                  <button
                    onClick={() => sharePost(post)}
                    className="text-xs text-green font-medium hover:underline"
                  >
                    Share
                  </button>
                  <button
                    onClick={() => deletePost(post.id)}
                    className="text-xs text-warm-gray hover:text-rose ml-auto"
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
