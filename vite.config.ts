import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc"; // Updated to react-swc
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    open: true  // Add this to automatically open browser
  },
  plugins: [
    react(),  // Only keep essential plugins
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});