import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CRMS6 IT',
    short_name: 'CRMS6 IT',
    description: 'Audio Visual Department Management System',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#06b6d4',
    icons: [
      {
        src: '/logo_2.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/logo_2.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
