import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// U-Contact dev server — منفصل عن U-Serve. يكلّم API اللايف (VITE_API_BASE).
export default defineConfig({
  plugins: [vue()],
  server: { port: 5180 },
})
