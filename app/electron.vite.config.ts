import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: path.resolve(__dirname, './src/main.ts'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: path.resolve(__dirname, './src/preload.ts'),
        formats: ['cjs'],
      },
      rollupOptions: {
        output: {
          entryFileNames: 'preload.js',
        },
      },
    },
  },
  renderer: {
    root: path.resolve(__dirname, './src'),
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, './src/index.html'),
      },
    },
  },
})

