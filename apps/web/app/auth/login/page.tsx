'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const OWNER_EMAILS = ['meetrj1386@gmail.com', 'shefalijain@gmail.com'];

type AuthMethod = 'email' | 'phone';

export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<AuthMethod>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
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

    // Admin users go to /admin, sellers go to /dashboard
    if (OWNER_EMAILS.includes(email.toLowerCase())) {
      router.push('/admin');
    } else {
      router.push('/dashboard');
    }
  };

  const sendOtp = async () => {
    if (!phone) { setError('Enter your phone number'); return; }
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone,
    });

    if (otpError) {
      setError(otpError.message);
      setLoading(false);
      return;
    }
    setOtpSent(true);
    setLoading(false);
  };

  const verifyOtp = async () => {
    if (!otp) { setError('Enter the OTP'); return; }
    setError('');
    setLoading(true);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: 'sms',
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    // Check if admin after OTP login
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email && OWNER_EMAILS.includes(user.email.toLowerCase())) {
      router.push('/admin');
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-sm border border-[#e7e0d4]">
        <Link href="/" className="font-display text-3xl text-ink block text-center mb-2">
          Klovi
        </Link>
        <p className="text-warm-gray text-center mb-6">Sign in to your dashboard</p>

        {/* Google Login */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-[#e7e0d4] rounded-xl hover:bg-cream/50 transition-colors mb-4 min-h-[48px]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span className="font-medium text-ink">Continue with Google</span>
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-[#e7e0d4]" />
          <span className="text-xs text-warm-gray">or</span>
          <div className="flex-1 h-px bg-[#e7e0d4]" />
        </div>

        {/* Method Toggle */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => { setMethod('email'); setError(''); setOtpSent(false); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              method === 'email' ? 'bg-ink text-white' : 'bg-cream text-warm-gray'
            }`}
          >
            Email
          </button>
          <button
            onClick={() => { setMethod('phone'); setError(''); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              method === 'phone' ? 'bg-ink text-white' : 'bg-cream text-warm-gray'
            }`}
          >
            Phone
          </button>
        </div>

        {method === 'email' ? (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-[#e7e0d4] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber text-ink"
              placeholder="you@example.com"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-[#e7e0d4] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber text-ink"
              placeholder="Password"
            />
            {error && <p className="text-rose text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-ink text-white rounded-xl font-semibold text-lg hover:bg-ink/90 disabled:opacity-50 transition-colors min-h-[48px]"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 border border-[#e7e0d4] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber text-ink"
              placeholder="+1 or +91 phone number"
              disabled={otpSent}
            />
            {otpSent && (
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                className="w-full px-4 py-3 border border-[#e7e0d4] rounded-xl focus:outline-none focus:ring-2 focus:ring-amber text-ink text-center text-2xl tracking-[0.5em]"
                placeholder="------"
              />
            )}
            {error && <p className="text-rose text-sm">{error}</p>}
            <button
              onClick={otpSent ? verifyOtp : sendOtp}
              disabled={loading}
              className="w-full py-4 bg-ink text-white rounded-xl font-semibold text-lg hover:bg-ink/90 disabled:opacity-50 transition-colors min-h-[48px]"
            >
              {loading ? 'Please wait...' : otpSent ? 'Verify OTP' : 'Send OTP'}
            </button>
            {otpSent && (
              <button
                onClick={() => { setOtpSent(false); setOtp(''); }}
                className="w-full text-sm text-warm-gray hover:text-ink"
              >
                Change number
              </button>
            )}
          </div>
        )}

        <p className="text-center text-warm-gray text-sm mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-amber font-medium hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
