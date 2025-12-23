import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    // Plugin to block processing files from other projects
    {
      name: "block-external-files",
      enforce: "pre",
      resolveId(id) {
        // Block any file from the other project
        if (id.includes("insightLM/gui/") || id.includes("IdeMessenger") || id.includes("vscode-webview")) {
          return null; // Don't process this file
        }
        return null;
      },
    },
    // Middleware to handle requests for non-existent files gracefully
    {
      name: "handle-missing-files",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Block requests for files outside this project
          if (req.url?.includes("IdeMessenger") ||
              req.url?.includes("ide-messenger") ||
              req.url?.includes("/insightLM/gui/") ||
              req.url?.includes("vscode-webview")) {
            res.statusCode = 404;
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Prevent Vite from resolving modules outside this project
    dedupe: [],
  },
  base: "./",
  server: {
    port: 5173,
    // Restrict file serving to this directory only
    fs: {
      strict: true,
      allow: [__dirname],
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  // Explicitly exclude files from other projects
  optimizeDeps: {
    exclude: ["vscode-webview"],
  },
});
