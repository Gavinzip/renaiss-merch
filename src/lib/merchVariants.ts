export const braceletColors = [
  { id: 'GOLD', label: 'Gold' },
  { id: 'SILVER', label: 'Silver' }
] as const;

export type BraceletColor = (typeof braceletColors)[number]['id'];

export function readBraceletColor(value: unknown): BraceletColor {
  return value === 'SILVER' ? 'SILVER' : 'GOLD';
}

export function readBraceletColorAssetId(color: BraceletColor) {
  return color.toLowerCase() as Lowercase<BraceletColor>;
}
