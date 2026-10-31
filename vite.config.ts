import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	worker: { format: "es" },
	plugins: [react(), cloudflare(), tailwindcss()],
});
