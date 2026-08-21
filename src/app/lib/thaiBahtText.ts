// Thai baht-text conversion — brief §6.2: "grand total — in THB with Thai
// Baht text line" (every document, not just tax invoices, which is why this
// is shared rather than living only where it was first needed).
const THAI_DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const THAI_PLACES = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

export function thaiBahtText(amount: number): string {
  const baht = Math.round(amount);
  if (baht === 0) return "ศูนย์บาทถ้วน";
  const digits = String(baht).split("").map(Number);
  let result = "";
  const len = digits.length;
  for (let i = 0; i < len; i++) {
    const digit = digits[i];
    const place = len - i - 1;
    if (digit === 0) continue;
    if (place % 6 === 1 && digit === 1) result += "สิบ";
    else if (place % 6 === 1 && digit === 2) result += "ยี่สิบ";
    else if (place % 6 === 0 && digit === 1 && len > 1 && place !== len - 1) result += "เอ็ด";
    else result += THAI_DIGITS[digit] + THAI_PLACES[place % 6];
    if (place > 0 && place % 6 === 0) result += "ล้าน";
  }
  return result + "บาทถ้วน";
}
