import { Monitor, Smartphone, Tablet } from 'lucide-react';

export function DeviceIcon({
  userAgent,
  className,
}: {
  userAgent: string | null;
  className?: string;
}) {
  const ua = userAgent ?? '';
  if (/iPad|Tablet/i.test(ua)) return <Tablet className={className} />;
  if (/Mobile|iPhone|Android/i.test(ua)) return <Smartphone className={className} />;
  return <Monitor className={className} />;
}
