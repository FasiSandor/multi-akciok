export type StoreId =
  | 'aldi' | 'lidl' | 'penny' | 'tesco' | 'spar' | 'auchan'
  | 'ikea' | 'decathlon' | 'obi' | 'praktiker' | 'deichmann' | 'jysk'
  | 'rossmann' | 'dm' | 'mediamarkt'
  | 'custom';

export type Offer = {
  id: string;
  name: string;
  category: string;
  store: StoreId;
  price: number;
  oldPrice?: number;
  unitLabel: string;
  unitPrice?: number;
  validFrom: string;
  validTo: string;
  image: string;
  loyaltyOnly?: boolean;
  sourceUrl?: string;
};

export type LoyaltyCard = {
  id: string;
  store: StoreId;
  label: string;
  code: string;
  format: 'qr' | 'barcode';
  note?: string;
  customStoreName?: string;
  customColor?: string;
};

export type CustomRetailer = {
  id: string;
  name: string;
  url?: string;
  color: string;
  note?: string;
};

export type Campaign = {
  id: string;
  store: StoreId;
  title: string;
  subtitle?: string;
  discountText?: string;
  code?: string;
  validFrom?: string;
  validTo?: string;
  loyaltyOnly?: boolean;
  sourceUrl: string;
};
