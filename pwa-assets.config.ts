import { createAppleSplashScreens, defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Genera icone e splash screen iOS da web/public/favicon.svg: npm run icons
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#1d4ed8' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#1d4ed8' } },
    appleSplashScreens: createAppleSplashScreens(
      {
        padding: 0.4,
        resizeOptions: { background: '#f6f7f9', fit: 'contain' },
        darkResizeOptions: { background: '#0f1115', fit: 'contain' },
        linkMediaOptions: { log: true, addMediaScreen: true, basePath: './splash/', xhtml: false },
        name: (landscape, size, dark) => `splash/apple-splash-${landscape ? 'landscape' : 'portrait'}-${dark ? 'dark-' : ''}${size.width}x${size.height}.png`,
      },
      ['iPhone 6', 'iPhone X', 'iPhone 11', 'iPhone 13', 'iPhone 14 Pro', 'iPhone 15 Pro Max', 'iPad Air 9.7"'],
    ),
  },
  images: ['web/public/favicon.svg'],
});
