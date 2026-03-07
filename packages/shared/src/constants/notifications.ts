export const NOTIFICATION_TEMPLATES = {
  new_order: {
    priority: 'critical' as const,
    titleTemplate: 'New order!',
    bodyTemplate: '{{customer_name}} - {{items}} - {{date}}. {{amount}} deposit received.',
  },
  message_flagged: {
    priority: 'critical' as const,
    titleTemplate: 'Customer needs you',
    bodyTemplate: "{{customer_name}} is asking something I can't answer. Tap to reply.",
  },
  bad_review: {
    priority: 'critical' as const,
    titleTemplate: 'Review received',
    bodyTemplate: '{{rating}}-star review from {{customer_name}}. Klovi is handling it. Tap to view.',
  },
  payment_received: {
    priority: 'critical' as const,
    titleTemplate: 'Payment received',
    bodyTemplate: '{{amount}} balance paid by {{customer_name}}. Order complete.',
  },
  hot_lead: {
    priority: 'important' as const,
    titleTemplate: 'Lead going cold',
    bodyTemplate: '{{customer_name}} asked about pricing {{time_ago}}. Tap to respond.',
  },
  low_stock: {
    priority: 'important' as const,
    titleTemplate: 'Low stock alert',
    bodyTemplate: 'Only {{count}} {{product_name}} left. Want to close orders?',
  },
  pickup_approaching: {
    priority: 'important' as const,
    titleTemplate: 'Pickup approaching',
    bodyTemplate: "{{customer_name}}'s pickup is in {{time}}. Ready to mark prepared?",
  },
  daily_summary: {
    priority: 'daily' as const,
    titleTemplate: 'Good Morning!',
    bodyTemplate: 'Today: {{order_count}} orders, {{revenue}} revenue, {{attention}} needs attention.',
  },
  interest_threshold: {
    priority: 'critical' as const,
    titleTemplate: 'People want your product!',
    bodyTemplate: '{{count}} people signed up! Potential {{revenue}} first weekend. Ready to take real orders?',
  },
} as const;

export const AUTOMATED_JOURNEY = {
  order_confirmation: { trigger: 'order_placed', delay_minutes: 0, channel: 'same_as_order' },
  prep_reminder: { trigger: 'pickup_date', delay_minutes: -2 * 24 * 60, channel: 'same_as_order' },
  order_ready: { trigger: 'seller_marks_ready', delay_minutes: 0, channel: 'same_as_order' },
  final_reminder: { trigger: 'pickup_time', delay_minutes: -2 * 60, channel: 'same_as_order' },
  review_request: { trigger: 'order_completed', delay_minutes: 2 * 60, channel: 'same_as_order' },
  review_followup: { trigger: 'review_request_sent', delay_minutes: 24 * 60, channel: 'same_as_order' },
  reorder_nudge: { trigger: 'order_completed', delay_minutes: 21 * 24 * 60, channel: 'same_as_order' },
} as const;
