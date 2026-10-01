import type { StoreId } from './types';

export const stores: Record<StoreId, { name: string; short: string; color: string; text: string; group: 'food'|'home'|'sport'|'diy'|'fashion'|'custom' }> = {
  aldi: { name: 'ALDI', short: 'ALDI', color: '#0b3a82', text: '#ffffff', group: 'food' },
  lidl: { name: 'Lidl', short: 'LIDL', color: '#0050aa', text: '#ffe500', group: 'food' },
  penny: { name: 'PENNY', short: 'PENNY', color: '#e40521', text: '#ffffff', group: 'food' },
  tesco: { name: 'Tesco', short: 'TESCO', color: '#ffffff', text: '#00539f', group: 'food' },
  spar: { name: 'SPAR', short: 'SPAR', color: '#0b8f43', text: '#ffffff', group: 'food' },
  auchan: { name: 'Auchan', short: 'AUCHAN', color: '#e31b23', text: '#ffffff', group: 'food' },
  ikea: { name: 'IKEA', short: 'IKEA', color: '#0058a3', text: '#ffda1a', group: 'home' },
  decathlon: { name: 'Decathlon', short: 'DECATH', color: '#1f5fd6', text: '#ffffff', group: 'sport' },
  obi: { name: 'OBI', short: 'OBI', color: '#f36f21', text: '#111111', group: 'diy' },
  praktiker: { name: 'Praktiker', short: 'PRAKT', color: '#f47c20', text: '#ffffff', group: 'diy' },
  deichmann: { name: 'Deichmann', short: 'DEICH', color: '#0082c8', text: '#ffffff', group: 'fashion' },
  jysk: { name: 'JYSK', short: 'JYSK', color: '#0b4da2', text: '#ffffff', group: 'home' },
  rossmann: { name: 'Rossmann', short: 'ROSS', color: '#e30613', text: '#ffffff', group: 'custom' },
  dm: { name: 'dm', short: 'dm', color: '#00a0df', text: '#ffffff', group: 'custom' },
  mediamarkt: { name: 'MediaMarkt', short: 'MEDIA', color: '#df0000', text: '#ffffff', group: 'custom' },
  custom: { name: 'Saját üzlet', short: 'SAJÁT', color: '#5b6472', text: '#ffffff', group: 'custom' }
};

export const knownStoreOrder: StoreId[] = [
  'aldi','lidl','penny','tesco','spar','auchan','ikea','decathlon','obi','praktiker','deichmann','jysk','rossmann','dm','mediamarkt'
];
