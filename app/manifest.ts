import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MULTI AKCIÓK',
    short_name: 'Akciók',
    description: 'Magyar üzletláncok akciói, ár-összehasonlítás, bevásárlólista és digitális hűségkártyák egy helyen.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0b2545',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }]
  };
}
