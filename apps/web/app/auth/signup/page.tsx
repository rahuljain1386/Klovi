'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setError('Signup failed');
      setLoading(false);
      return;
    }

    // Create seller profile
    const slug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();

    const { error: sellerError } = await supabase.from('sellers').insert({
      user_id: authData.user.id,
      business_name: businessName,
      slug,
      status: 'onboarding',
      plan: 'free',
      country: 'usa',
      language: 'en',
    });

    if (sellerError) {
      setError('Failed to create business profile. Please try again.');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border border-[#e7e0d4]">
        <Link href="/" className="font-display text-3xl text-ink block text-center mb-2">
          Klovi
        </Link>
        <p className="text-warm-gray text-center mb-8">Start your business journey</p>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-ink block mb-1">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              required
              className="w-full px-4 py-3 border border-[#e7e0d4] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber text-ink"
              placeholder="e.g., Sunita's Kitchen"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-ink block mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-[#e7e0d4] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber text-ink"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-ink block mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 border border-[#e7e0d4] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber text-ink"
              placeholder="At least 6 characters"
            />
          </div>

          {error && <p className="text-rose text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-amber text-white rounded-xl font-semibold text-lg hover:bg-amber/90 disabled:opacity-50 transition-colors min-h-[48px]"
          >
            {loading ? 'Creating account...' : 'Create Free Account'}
          </button>
        </form>

        <p className="text-center text-warm-gray text-sm mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-amber font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
