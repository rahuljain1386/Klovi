'use client';

import { useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';

export default function ReviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const submitReview = async () => {
    if (!rating) {
      setError('Please select a rating');
      return;
    }

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, rating, comment }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to submit review');
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  if (submitted) {
    return (
      <main className="min-h-screen bg-cream flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-sm border border-[#e7e0d4]">
          <div className="text-5xl mb-4">
            {rating >= 4 ? '\u2728' : '\U0001F64F'}
          </div>
          <h1 className="font-display text-2xl text-ink mb-2">Thank you!</h1>
          <p className="text-warm-gray">
            Your feedback means a lot and helps us improve.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border border-[#e7e0d4]">
        <h1 className="font-display text-2xl text-ink mb-2">How was your experience?</h1>
        <p className="text-warm-gray mb-6">Your honest feedback helps the business grow.</p>

        {/* Star Rating */}
        <div className="flex gap-2 mb-6 justify-center">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              className="text-4xl transition-transform hover:scale-110"
              aria-label={`${star} star${star > 1 ? 's' : ''}`}
            >
              {star <= rating ? '\u2B50' : '\u2606'}
            </button>
          ))}
        </div>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Tell us more about your experience (optional)"
          className="w-full p-4 border border-[#e7e0d4] rounded-xl text-ink bg-cream/50 resize-none h-32 focus:outline-none focus:ring-2 focus:ring-amber"
        />

        {error && (
          <p className="text-rose mt-3 text-sm">{error}</p>
        )}

        <button
          onClick={submitReview}
          disabled={!rating}
          className="w-full mt-6 py-4 bg-ink text-white rounded-xl font-semibold text-lg disabled:opacity-50 hover:bg-ink/90 transition-colors min-h-[48px]"
        >
          Submit Review
        </button>
      </div>
    </main>
  );
}
