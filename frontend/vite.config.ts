import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy all API requests to the backend server
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, '/api') // Keep the /api prefix for the backend
      }
    }
  },
  // Fix for HMR in some environments
  define: {
    'process.env': {}
  }
})
