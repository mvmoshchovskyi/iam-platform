import { UAParser } from 'ua-parser-js';

/** Human-readable device label, e.g. "Chrome 140 on Windows". */
export const describeDevice = (userAgent: string | null | undefined): string => {
  if (!userAgent) return 'Unknown device';
  const { browser, os, device } = new UAParser(userAgent).getResult();
  const browserLabel = browser.name
    ? `${browser.name}${browser.major ? ` ${browser.major}` : ''}`
    : null;
  const osLabel = os.name ? `${os.name}${os.version ? ` ${os.version}` : ''}` : null;
  const deviceLabel = device.vendor ? `${device.vendor} ${device.model ?? ''}`.trim() : null;
  const parts = [
    browserLabel ?? userAgent.slice(0, 40),
    osLabel && `on ${osLabel}`,
    deviceLabel && `(${deviceLabel})`,
  ];
  return parts.filter(Boolean).join(' ');
};
