import { createServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';

const STATUS_STEPS = [
  { key: 'placed', label: 'Order Placed' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
  { key: 'collected', label: 'Collected' },
];

export default async function OrderTrackingPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();

  const { data: order } = await supabase
    .from('orders')
    .select('*, seller:sellers(business_name, phone), customer:customers(name)')
    .eq('id', params.id)
    .single();

  if (!order) return notFound();

  const currentIndex = STATUS_STEPS.findIndex((s) => s.key === order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <main className="min-h-screen bg-cream p-6">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 border border-[#e7e0d4] mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="font-display text-2xl text-ink">{order.order_number}</h1>
              <p className="text-warm-gray mt-1">from {order.seller?.business_name}</p>
            </div>
            {isCancelled ? (
              <span className="bg-rose/10 text-rose text-sm font-semibold px-3 py-1 rounded-full">
                Cancelled
              </span>
            ) : (
              <span className="bg-green/10 text-green text-sm font-semibold px-3 py-1 rounded-full">
                {STATUS_STEPS[currentIndex]?.label || order.status}
              </span>
            )}
          </div>
        </div>

        {/* Progress Steps */}
        {!isCancelled && (
          <div className="bg-white rounded-2xl p-6 border border-[#e7e0d4] mb-6">
            <h2 className="font-semibold text-ink mb-4">Order Progress</h2>
            <div className="space-y-0">
              {STATUS_STEPS.map((step, index) => {
                const isCompleted = index <= currentIndex;
                const isCurrent = index === currentIndex;

                return (
                  <div key={step.key} className="flex items-start gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                          isCompleted
                            ? 'bg-green text-white'
                            : 'bg-[#e7e0d4] text-warm-gray'
                        } ${isCurrent ? 'ring-4 ring-green/20' : ''}`}
                      >
                        {isCompleted ? '\u2713' : index + 1}
                      </div>
                      {index < STATUS_STEPS.length - 1 && (
                        <div
                          className={`w-0.5 h-8 ${
                            index < currentIndex ? 'bg-green' : 'bg-[#e7e0d4]'
                          }`}
                        />
                      )}
                    </div>
                    <div className="pt-1">
                      <p
                        className={`font-medium ${
                          isCompleted ? 'text-ink' : 'text-warm-gray'
                        }`}
                      >
                        {step.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="bg-white rounded-2xl p-6 border border-[#e7e0d4] mb-6">
          <h2 className="font-semibold text-ink mb-4">Items</h2>
          {order.items?.map((item: any, i: number) => (
            <div
              key={i}
              className="flex justify-between py-3 border-b border-[#e7e0d4] last:border-0"
            >
              <div>
                <p className="text-ink font-medium">
                  {item.quantity}x {item.product_name}
                </p>
                {item.variant && (
                  <p className="text-warm-gray text-sm">{item.variant}</p>
                )}
              </div>
              <p className="text-ink font-semibold">
                {order.currency === 'INR' ? '\u20B9' : '$'}
                {(item.price * item.quantity).toFixed(2)}
              </p>
            </div>
          ))}
          <div className="flex justify-between pt-4 mt-2 border-t border-[#e7e0d4]">
            <p className="font-semibold text-ink text-lg">Total</p>
            <p className="font-bold text-ink text-lg">
              {order.currency === 'INR' ? '\u20B9' : '$'}
              {order.total?.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Fulfillment Details */}
        <div className="bg-white rounded-2xl p-6 border border-[#e7e0d4]">
          <h2 className="font-semibold text-ink mb-3">
            {order.fulfillment_type === 'pickup'
              ? 'Pickup Details'
              : order.fulfillment_type === 'delivery'
              ? 'Delivery Details'
              : 'Shipping Details'}
          </h2>
          {order.fulfillment_type === 'pickup' && (
            <p className="text-warm-gray">
              Ready for pickup. Contact {order.seller?.business_name} for location details.
            </p>
          )}
          {order.delivery_address && (
            <p className="text-warm-gray">{order.delivery_address}</p>
          )}
          {order.scheduled_date && (
            <p className="text-warm-gray mt-2">
              Scheduled: {new Date(order.scheduled_date).toLocaleDateString()}
              {order.scheduled_time && ` at ${order.scheduled_time}`}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
