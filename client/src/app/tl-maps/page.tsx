'use server';

import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LegacyTlMapsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const qs = new URLSearchParams();

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => qs.append(key, v));
    } else if (typeof value === 'string') {
      qs.append(key, value);
    }
  });

  const target = `/map-canvas${qs.toString() ? `?${qs.toString()}` : ''}`;
  redirect(target);
}
