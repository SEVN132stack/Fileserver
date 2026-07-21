import QRCode from 'qrcode';

// Genereer een QR-code als SVG-string voor een tekst/URL.
export async function qrSvg(text) {
  return QRCode.toString(text, { type: 'svg', margin: 1, width: 220 });
}
