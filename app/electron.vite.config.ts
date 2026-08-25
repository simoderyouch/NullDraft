import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const cloudApiUrl = process.env.NULLDRAFT_CLOUD_API_URL || 'http://127.0.0.1:8010'
const requireCloudAccess = process.env.NULLDRAFT_REQUIRE_CLOUD_ACCESS === '1'

export default defineConfig({
  main: {
    define: {
      'process.env.NULLDRAFT_CLOUD_API_URL': JSON.stringify(cloudApiUrl),
      'process.env.NULLDRAFT_REQUIRE_CLOUD_ACCESS': JSON.stringify(requireCloudAccess ? '1' : ''),
    },
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: path.resolve(__dirname, './src/main.ts'),
      },
    },
  },
  preload: {
    define: {
      'process.env.NULLDRAFT_CLOUD_API_URL': JSON.stringify(cloudApiUrl),
      'process.env.NULLDRAFT_REQUIRE_CLOUD_ACCESS': JSON.stringify(requireCloudAccess ? '1' : ''),
    },
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
    server: {
      host: '127.0.0.1',
    },
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
