import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CRMS6 IT',
    short_name: 'CRMS6 IT',
    description: 'ระบบสารสนเทศเพื่อการบริหารจัดการ งานโสตทัศนศึกษา by CRMS6 IT',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#06b6d4',
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}

