export const formatCurrency = (amount: number): string => {
  return "฿" + amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatCurrencyExport = (amount: number): string => {
  return amount.toFixed(2);
};

export const parseTHBString = (s: string): number => {
  return parseFloat(s.replace(/,/g, "").replace(/\s*THB\s*/gi, "")) || 0;
};

export const formatTHBString = (s: string): string => {
  return formatCurrency(parseTHBString(s));
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat("en-US").format(num);
};
