import Link from 'next/link';
import { ArrowRight, MessageSquare, ShoppingBag, BarChart3, Zap, Shield, Globe } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 md:px-12 py-4 bg-white/80 backdrop-blur-sm border-b border-border sticky top-0 z-50">
        <Link href="/" className="font-display text-2xl font-black">
          <span className="text-amber">K</span>LOVI
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-warm-gray">
          <Link href="#features" className="hover:text-ink transition-colors">Features</Link>
          <Link href="#pricing" className="hover:text-ink transition-colors">Pricing</Link>
          <Link href="/discover" className="hover:text-ink transition-colors">Discover Sellers</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-sm font-medium text-warm-gray hover:text-ink transition-colors">Log in</Link>
          <Link href="/auth/signup" className="bg-ink text-amber px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-ink/90 transition-colors">Start Free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 md:px-12 pt-20 pb-24 md:pt-32 md:pb-36 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-amber-light text-amber-dark px-4 py-1.5 rounded-full text-xs font-semibold mb-6">
          <Zap className="w-3.5 h-3.5" /> Go live in 5 minutes
        </div>
        <h1 className="font-display text-5xl md:text-7xl font-black leading-[1.05] tracking-tight mb-6">
          Run your home business<br /><span className="text-amber">like a pro</span>
        </h1>
        <p className="text-lg md:text-xl text-warm-gray max-w-2xl mx-auto mb-10 font-light leading-relaxed">
          Connect your WhatsApp, Instagram, and Facebook once. Klovi reads everything, replies automatically, and never misses an order.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/auth/signup" className="bg-amber hover:bg-amber-dark text-white px-8 py-4 rounded-full text-base font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-amber/30">
            Start Your Business Free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/test-idea" className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-4 rounded-full text-base font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-purple-600/30">
            Test your idea first <Zap className="w-4 h-4" />
          </Link>
        </div>
        <p className="text-xs text-warm-gray/60 mt-4">No credit card required. Not sure yet? <Link href="/test-idea" className="text-purple-600 hover:underline font-medium">Test demand before you invest anything</Link>.</p>
      </section>

      {/* Stats bar */}
      <section className="bg-ink py-6 px-6">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-8 md:gap-16">
          {[
            { num: '5 min', label: 'To go fully live' },
            { num: '80%', label: 'Messages auto-handled' },
            { num: '100%', label: 'Revenue you keep' },
            { num: '0', label: 'Orders ever missed' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="font-display text-3xl font-black text-amber">{s.num}</div>
              <div className="text-xs text-stone-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section className="px-6 md:px-12 py-20 max-w-6xl mx-auto">
        <h2 className="font-display text-3xl md:text-4xl font-black text-center mb-4">For every home business</h2>
        <p className="text-warm-gray text-center mb-12 max-w-xl mx-auto">Whether you already sell from home or want to start - Klovi handles the business side so you can focus on what you love.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Home Bakers', icon: '🍰' }, { label: 'Tiffin Services', icon: '🍱' },
            { label: 'Tutors & Coaches', icon: '📚' }, { label: 'Jewelry Makers', icon: '💍' },
            { label: 'Beauty & Mehndi', icon: '💅' }, { label: 'Craft Sellers', icon: '🎨' },
            { label: 'Fitness Trainers', icon: '💪' }, { label: 'And more...', icon: '✨' },
          ].map((item) => (
            <div key={item.label} className="bg-white rounded-2xl border border-border p-5 text-center hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="text-3xl mb-2">{item.icon}</div>
              <div className="text-sm font-semibold">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-6 md:px-12 py-20 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-black text-center mb-4">Everything you need. Nothing you don&apos;t.</h2>
          <p className="text-warm-gray text-center mb-16 max-w-xl mx-auto">Klovi replaces 5 apps with one. Booking, payments, messaging, marketing, and an AI assistant.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <MessageSquare className="w-6 h-6" />, title: 'Unified Inbox', desc: 'WhatsApp, Instagram DM, Facebook - all messages in one place. AI replies to 80% automatically.', color: 'bg-teal-light text-teal' },
              { icon: <ShoppingBag className="w-6 h-6" />, title: 'Orders & Payments', desc: 'Deposits, balance collection, COD - handled automatically. Stripe, Razorpay, UPI supported.', color: 'bg-green-100 text-green-600' },
              { icon: <BarChart3 className="w-6 h-6" />, title: 'AI Business Coach', desc: 'Klovi tells you what to sell, when to promote, and handles seasonal marketing for you.', color: 'bg-purple-100 text-purple-600' },
              { icon: <Globe className="w-6 h-6" />, title: 'Your Own Booking Page', desc: 'Professional storefront auto-generated. Menu, reviews, trust badges - share one link everywhere.', color: 'bg-amber-light text-amber-dark' },
              { icon: <Shield className="w-6 h-6" />, title: 'Review & Reputation', desc: 'Auto-request reviews. Bad review? AI handles recovery before you even see it.', color: 'bg-rose-50 text-rose-500' },
              { icon: <Zap className="w-6 h-6" />, title: 'Instagram Auto-Post', desc: 'AI creates branded posts with enhanced photos and publishes them to your feed automatically.', color: 'bg-blue-50 text-blue-500' },
            ].map((f) => (
              <div key={f.title} className="bg-cream rounded-2xl p-6 hover:shadow-lg transition-shadow">
                <div className={`w-12 h-12 ${f.color} rounded-xl flex items-center justify-center mb-4`}>{f.icon}</div>
                <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                <p className="text-sm text-warm-gray leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 md:px-12 py-20 max-w-4xl mx-auto">
        <h2 className="font-display text-3xl md:text-4xl font-black text-center mb-16">Live in 5 minutes. Seriously.</h2>
        <div className="space-y-12">
          {[
            { step: '1', title: 'Describe your business', desc: "Speak or type what you sell, your city, and your shop name. That's it.", time: '1 min' },
            { step: '2', title: 'Add your catalog', desc: 'Take a photo of your menu, speak your items, or paste a message. AI extracts everything.', time: '2 min' },
            { step: '3', title: 'Connect channels & payments', desc: 'Link WhatsApp, Instagram, and your payment method. One-time setup.', time: '2 min' },
            { step: '4', title: 'Share your link', desc: 'Your booking page is live. Share it on WhatsApp, Instagram, Facebook. Orders start flowing.', time: 'Done!' },
          ].map((s) => (
            <div key={s.step} className="flex gap-6 items-start">
              <div className="w-12 h-12 bg-ink rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-amber font-display font-black text-lg">{s.step}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="font-semibold text-lg">{s.title}</h3>
                  <span className="text-xs bg-amber-light text-amber-dark px-2 py-0.5 rounded-full font-semibold">{s.time}</span>
                </div>
                <p className="text-warm-gray text-sm">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 md:px-12 py-20 bg-ink">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-3xl md:text-4xl font-black text-center text-white mb-3">Simple pricing. <span className="text-amber">No commission.</span></h2>
          <p className="text-stone-400 text-center mb-12 max-w-lg mx-auto text-sm">You keep 100% of your revenue. Always. We charge a flat monthly fee.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: 'Free Forever', price: '$0', priceInr: '₹0', features: ['Booking page', '10 orders/month', 'Basic dashboard', 'Customer portal'], cta: 'Start Free', featured: false },
              { name: 'Growth', price: '$19', priceInr: '₹399', features: ['Unlimited orders', 'AI messaging', 'Photo enhancement', 'Dedicated number', 'Broadcasts', 'Inventory & COD', 'Customer segments'], cta: 'Start Growing', featured: true },
              { name: 'Pro', price: '$39', priceInr: '₹799', features: ['Everything in Growth', 'AI Business Coach', 'Instagram auto-post', 'Full analytics', 'Smart segments', 'Priority support', 'Marketing autopilot'], cta: 'Go Pro', featured: false },
            ].map((plan) => (
              <div key={plan.name} className={`rounded-2xl p-6 ${plan.featured ? 'bg-amber text-ink ring-2 ring-amber shadow-xl shadow-amber/20 scale-105' : 'bg-white/5 text-white border border-white/10'}`}>
                <div className="text-sm font-semibold mb-4 opacity-80">{plan.name}</div>
                <div className="mb-1">
                  <span className="font-display text-4xl font-black">{plan.price}</span>
                  <span className="text-sm opacity-60">/month</span>
                </div>
                <div className="text-xs opacity-50 mb-6">{plan.priceInr}/month in India</div>
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth/signup" className={`block text-center py-3 rounded-full text-sm font-semibold transition-colors ${plan.featured ? 'bg-ink text-amber hover:bg-ink/90' : 'bg-white/10 hover:bg-white/20'}`}>{plan.cta}</Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-12 py-20 text-center">
        <h2 className="font-display text-3xl md:text-4xl font-black mb-4">Ready to run your business like a pro?</h2>
        <p className="text-warm-gray mb-8 max-w-md mx-auto">Join home sellers who stopped losing orders and started growing.</p>
        <Link href="/auth/signup" className="inline-flex items-center gap-2 bg-amber hover:bg-amber-dark text-white px-8 py-4 rounded-full text-base font-semibold transition-colors shadow-lg shadow-amber/30">
          Start Free Today <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-ink text-stone-400 px-6 md:px-12 py-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between gap-8">
          <div>
            <div className="font-display text-xl font-black mb-2"><span className="text-amber">K</span><span className="text-white">LOVI</span></div>
            <p className="text-xs max-w-xs">Run your home business like a pro. Booking, payments, AI messaging - all in one place.</p>
          </div>
          <div className="flex gap-12 text-xs">
            <div>
              <div className="text-white font-semibold mb-3">Product</div>
              <div className="space-y-2">
                <div><Link href="#features" className="hover:text-white transition-colors">Features</Link></div>
                <div><Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link></div>
                <div><Link href="/discover" className="hover:text-white transition-colors">Discover</Link></div>
              </div>
            </div>
            <div>
              <div className="text-white font-semibold mb-3">Company</div>
              <div className="space-y-2">
                <div><Link href="/about" className="hover:text-white transition-colors">About</Link></div>
                <div><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></div>
                <div><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></div>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-white/10 text-xs text-center">Klovi 2026. All rights reserved.</div>
      </footer>
    </main>
  );
}
