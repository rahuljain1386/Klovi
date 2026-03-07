import Link from 'next/link';

const plans = [
  {
    name: 'Free Forever',
    id: 'free',
    priceUSA: '$0',
    priceIndia: '\u20B90',
    period: '/month',
    description: 'Perfect for getting started',
    features: [
      '10 orders per month',
      'Shared WhatsApp number',
      'Basic photo enhancement',
      'Booking page (klovi.com/you)',
      'Customer portal',
      'Inventory management',
      'Cash on delivery',
    ],
    notIncluded: [
      'AI messaging',
      'Background removal',
      'Broadcasts',
      'AI Business Coach',
      'Instagram auto-publishing',
    ],
    cta: 'Start Free',
    highlighted: false,
  },
  {
    name: 'Growth',
    id: 'growth',
    priceUSA: '$19',
    priceIndia: '\u20B9399',
    period: '/month',
    description: 'For growing businesses',
    features: [
      'Unlimited orders',
      'Virtual dedicated WhatsApp',
      'AI messaging (auto-replies)',
      'Full photo enhancement',
      'Background removal',
      'Broadcasts to customers',
      'Standard analytics',
      'Everything in Free',
    ],
    notIncluded: [
      'AI Business Coach',
      'Instagram auto-publishing',
    ],
    cta: 'Start 14-day Trial',
    highlighted: true,
  },
  {
    name: 'Pro',
    id: 'pro',
    priceUSA: '$39',
    priceIndia: '\u20B9799',
    period: '/month',
    description: 'Full power, maximum growth',
    features: [
      'Everything in Growth',
      'Your own WhatsApp number',
      'AI Business Coach',
      'Instagram auto-publishing',
      'Full analytics & insights',
      'Google Trends demand data',
      'Priority support',
    ],
    notIncluded: [],
    cta: 'Start 14-day Trial',
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-cream">
      {/* Header */}
      <div className="py-16 px-6 text-center">
        <h1 className="font-display text-4xl md:text-5xl text-ink mb-4">
          Simple, honest pricing
        </h1>
        <p className="text-lg text-warm-gray max-w-2xl mx-auto">
          No commission on your sales. Ever. Just a flat monthly fee that grows with you.
        </p>
      </div>

      {/* Plans Grid */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl p-8 border ${
                plan.highlighted
                  ? 'border-amber ring-2 ring-amber/20 relative'
                  : 'border-[#e7e0d4]'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber text-white text-sm font-semibold px-4 py-1 rounded-full">
                  Most Popular
                </div>
              )}

              <h2 className="font-display text-2xl text-ink">{plan.name}</h2>
              <p className="text-warm-gray mt-1 mb-4">{plan.description}</p>

              <div className="mb-6">
                <span className="text-4xl font-bold text-ink">{plan.priceUSA}</span>
                <span className="text-warm-gray">{plan.period}</span>
                <div className="text-sm text-warm-gray mt-1">
                  or {plan.priceIndia}{plan.period} in India
                </div>
              </div>

              <Link
                href="/auth/signup"
                className={`block w-full py-4 rounded-xl font-semibold text-center text-lg min-h-[48px] ${
                  plan.highlighted
                    ? 'bg-amber text-white hover:bg-amber/90'
                    : 'bg-ink text-white hover:bg-ink/90'
                } transition-colors`}
              >
                {plan.cta}
              </Link>

              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <span className="text-green mt-0.5 flex-shrink-0">&#10003;</span>
                    <span className="text-ink">{feature}</span>
                  </li>
                ))}
                {plan.notIncluded.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 opacity-50">
                    <span className="text-warm-gray mt-0.5 flex-shrink-0">&#10007;</span>
                    <span className="text-warm-gray">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <div className="text-center mt-12">
          <p className="text-warm-gray text-lg">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </div>
      </div>
    </main>
  );
}
