import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/nanodigest-redesign/" : "/",
  plugins: [react()],
  base: "/nanodigest-redesign/",
  resolve: {
    alias: {
      "@": "/src",
    },
  },
}));
