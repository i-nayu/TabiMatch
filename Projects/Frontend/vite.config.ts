import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true, // ファイル変更を強制監視
      interval: 100,    // 監視間隔(ms)
    },
  },
})