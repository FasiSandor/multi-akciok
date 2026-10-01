import type { Offer } from './types';

export const fallbackOffers: Offer[] = [
  {
    id: 'penny-chicken', name: 'Csirkemellfilé', category: 'Hús', store: 'penny', price: 1299, oldPrice: 1799,
    unitLabel: '1 kg', unitPrice: 1299, validFrom: '2026-10-01', validTo: '2026-10-03',
    image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'aldi-banana', name: 'Banán', category: 'Zöldség-gyümölcs', store: 'aldi', price: 399, oldPrice: 499,
    unitLabel: '1 kg', unitPrice: 399, validFrom: '2026-10-01', validTo: '2026-10-04',
    image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=640&q=80',
    sourceUrl: 'https://www.aldi.hu/szuper-akciok-mindennap'
  },
  {
    id: 'lidl-cheese', name: 'Trappista sajt', category: 'Tejtermék', store: 'lidl', price: 1699, oldPrice: 2299,
    unitLabel: '700 g', unitPrice: 2427, validFrom: '2026-10-01', validTo: '2026-10-07',
    image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'tesco-milk', name: 'Tej 2,8%', category: 'Tejtermék', store: 'tesco', price: 329, oldPrice: 399,
    unitLabel: '1 l', unitPrice: 329, validFrom: '2026-10-01', validTo: '2026-10-07', loyaltyOnly: true,
    image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'spar-bread', name: 'Friss kenyér', category: 'Pékáru', store: 'spar', price: 399, oldPrice: 499,
    unitLabel: '1 db', validFrom: '2026-10-01', validTo: '2026-10-07',
    image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'aldi-eggs', name: 'Tojás M', category: 'Tejtermék', store: 'aldi', price: 699, oldPrice: 849,
    unitLabel: '10 db', validFrom: '2026-10-01', validTo: '2026-10-04',
    image: 'https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'lidl-tomato', name: 'Paradicsom', category: 'Zöldség-gyümölcs', store: 'lidl', price: 699, oldPrice: 899,
    unitLabel: '1 kg', unitPrice: 699, validFrom: '2026-10-01', validTo: '2026-10-07',
    image: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'penny-apple', name: 'Alma', category: 'Zöldség-gyümölcs', store: 'penny', price: 499, oldPrice: 649,
    unitLabel: '1 kg', unitPrice: 499, validFrom: '2026-10-01', validTo: '2026-10-03',
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=640&q=80'
  },
  {
    id: 'auchan-butter', name: 'Vaj 82%', category: 'Tejtermék', store: 'auchan', price: 799, oldPrice: 999,
    unitLabel: '250 g', unitPrice: 3196, validFrom: '2026-10-01', validTo: '2026-10-07',
    image: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?auto=format&fit=crop&w=640&q=80'
  }
];
