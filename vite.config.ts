import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Thêm dòng này (Dùng đường dẫn tương đối để chạy ở đâu cũng được)
})
