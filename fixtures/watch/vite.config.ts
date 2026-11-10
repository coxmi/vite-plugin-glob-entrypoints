import { defineConfig } from 'vite'
import entrypoints from 'vite-plugin-glob-entrypoints'

export default defineConfig({
  plugins: [
    entrypoints({
      main: ['src/main.ts', 'styles/*.css', 'src/*/*.tsx']
    }),
  ],
})
