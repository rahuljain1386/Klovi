export function formatCurrency(amount: number, currency: 'USD' | 'INR' | 'CAD'): string {
  const symbols: Record<string, string> = { USD: '$', INR: '\u20B9', CAD: 'CA$' };
  return `${symbols[currency] || currency}${amount.toLocaleString()}`;
}

export function formatOrderNumber(num: number): string {
  return `KLV-${String(num).padStart(4, '0')}`;
}

export function formatPhone(phone: string, market: 'usa' | 'india' | 'canada'): string {
  const cleaned = phone.replace(/\D/g, '');
  if (market === 'india') {
    return `+91 ${cleaned.slice(-10, -5)} ${cleaned.slice(-5)}`;
  }
  return `+1 (${cleaned.slice(-10, -7)}) ${cleaned.slice(-7, -4)}-${cleaned.slice(-4)}`;
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function getSegment(
  totalOrders: number,
  lastOrderDate: string | null
): 'new' | 'active' | 'loyal' | 'dormant' {
  if (totalOrders === 0) return 'new';
  const daysSince = lastOrderDate
    ? Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;
  if (daysSince > 45) return 'dormant';
  if (totalOrders >= 3) return 'loyal';
  return 'active';
}
