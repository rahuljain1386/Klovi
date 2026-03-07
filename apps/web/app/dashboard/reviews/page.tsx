'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  ai_sentiment: string | null;
  created_at: string;
  customer: { name: string } | null;
};

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);

  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: seller } = await supabase
      .from('sellers')
      .select('id, avg_rating')
      .eq('user_id', user.id)
      .single();

    if (!seller) return;
    setAvgRating(seller.avg_rating || 0);

    const { data } = await supabase
      .from('reviews')
      .select('id, rating, comment, ai_sentiment, created_at, customer:customers(name)')
      .eq('seller_id', seller.id)
      .order('created_at', { ascending: false });

    setReviews((data as unknown as Review[]) || []);
  };

  const stars = (n: number) => {
    return Array.from({ length: 5 }, (_, i) => i < n ? '\u2605' : '\u2606').join('');
  };

  const sentimentColor = (s: string | null) => {
    if (s === 'positive') return 'text-green';
    if (s === 'negative') return 'text-rose';
    return 'text-warm-gray';
  };

  return (
    <div>
      <h1 className="font-display text-3xl text-ink mb-6">Reviews</h1>

      {/* Summary */}
      <div className="bg-white rounded-xl p-6 border border-[#e7e0d4] mb-6 flex items-center gap-8">
        <div>
          <p className="text-4xl font-bold text-ink">{avgRating ? avgRating.toFixed(1) : '-'}</p>
          <p className="text-amber text-lg">{stars(Math.round(avgRating))}</p>
        </div>
        <div>
          <p className="text-warm-gray">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-[#e7e0d4] text-center">
          <p className="text-warm-gray text-lg">No reviews yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="bg-white rounded-xl p-5 border border-[#e7e0d4]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-amber">{stars(review.rating)}</span>
                  <span className="font-medium text-ink">{review.customer?.name || 'Anonymous'}</span>
                </div>
                <div className="flex items-center gap-3">
                  {review.ai_sentiment && (
                    <span className={`text-xs font-medium capitalize ${sentimentColor(review.ai_sentiment)}`}>
                      {review.ai_sentiment}
                    </span>
                  )}
                  <span className="text-xs text-warm-gray">
                    {new Date(review.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              {review.comment && (
                <p className="text-sm text-ink mt-1">{review.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
