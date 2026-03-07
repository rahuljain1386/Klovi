'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
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
        <p className="text-warm-gray text-center mb-8">Sign in to your dashboard</p>

        <form onSubmit={handleLogin} className="space-y-4">
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
              className="w-full px-4 py-3 border border-[#e7e0d4] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber text-ink"
              placeholder="Your password"
            />
          </div>

          {error && <p className="text-rose text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-ink text-white rounded-xl font-semibold text-lg hover:bg-ink/90 disabled:opacity-50 transition-colors min-h-[48px]"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-warm-gray text-sm mt-6">
          Don't have an account?{' '}
          <Link href="/auth/signup" className="text-amber font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
