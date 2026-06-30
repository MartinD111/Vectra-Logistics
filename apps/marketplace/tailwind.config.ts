import type { Config } from 'tailwindcss'
import sharedPreset from '@vectra/config/tailwind.preset.js'

const config: Config = {
  presets: [sharedPreset as Partial<Config>],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
    '../../packages/auth/src/**/*.{js,ts,jsx,tsx}',
    '../../packages/data/src/**/*.{js,ts,jsx,tsx}',
  ],
}
export default config
