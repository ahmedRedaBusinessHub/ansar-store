import { toString as qrToString } from "qrcode";

/** SVG markup for a ticket QR. Server-side only. */
export async function qrSvg(payload: string): Promise<string> {
  return qrToString(payload, { type: "svg", errorCorrectionLevel: "M", margin: 1, width: 240 });
}
