import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Validate VITE_API_URL is set in production builds
if (process.env.NODE_ENV === "production" && !process.env.VITE_API_URL) {
  console.error("FATAL: VITE_API_URL environment variable is not set for production build");
  console.error("Please set VITE_API_URL to your backend API URL (e.g., https://myapp-backend.railway.app)");
  process.exit(1);
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
