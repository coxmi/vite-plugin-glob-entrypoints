
# vite-plugin-glob-entrypoints

This plugin allows setting multiple entrypoints in your vite config.

## Install

```sh
npm install --save-dev vite-plugin-glob-entrypoints
```

## Configure

```ts
import { defineConfig } from 'vite'
import entrypoints from 'vite-plugin-glob-entrypoints'

export default defineConfig({
  plugins: [
    entrypoints({
      main: [
        'app/main.ts',
        'style/extra.css',
        'components/*/*.{js,jsx,ts,tsx,css}',
      ],
      admin: [
        'app/admin.ts'
      ],
    }),
  ],
})
```