import { config } from './config.js';

// Geo-/IP-blokkering: weiger toegang uit geblokkeerde landen (op basis van de
// geo-header, bijv. Cloudflare's cf-ipcountry) en/of geblokkeerde IP-bereiken
// (CIDR). Landen gelden alleen waar een geo-header beschikbaar is (web achter een
// proxy); CIDR-blokken gelden overal, ook voor SFTP (ruwe TCP zonder header).

export function isBlockedCountry(country) {
  if (!country || !config.blockedCountries.length) return false;
  return config.blockedCountries.includes(String(country).toUpperCase());
}

// Eenvoudige IPv4-CIDR-match (bijv. "10.0.0.0/8"). Zonder prefix: exacte match.
function ipv4InCidr(ip, cidr) {
  const [range, bitsRaw] = cidr.split('/');
  const bits = parseInt(bitsRaw, 10);
  if (Number.isNaN(bits) || bits < 0 || bits > 32) return false;
  const toInt = (a) => a.split('.').reduce((acc, o) => (acc << 8) + (parseInt(o, 10) & 255), 0) >>> 0;
  const ipParts = ip.split('.');
  const rangeParts = range.split('.');
  if (ipParts.length !== 4 || rangeParts.length !== 4) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (toInt(ip) & mask) === (toInt(range) & mask);
}

export function isBlockedIp(ip) {
  if (!ip || !config.blockedCidrs.length) return false;
  // Normaliseer een IPv4-mapped IPv6-adres (::ffff:1.2.3.4).
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  return config.blockedCidrs.some((c) => (c.includes('/') ? ipv4InCidr(v4, c) : v4 === c || ip === c));
}

// Geef een reden ('ip' | 'land') als deze toegang geblokkeerd is, anders null.
export function blockReason(ip, country) {
  if (isBlockedIp(ip)) return 'ip';
  if (isBlockedCountry(country)) return 'land';
  return null;
}
