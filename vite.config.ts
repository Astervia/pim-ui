import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const host = process.env.TAURI_DEV_HOST;

// Resolve UI version from package.json at config-load time (Phase 3 03-06
// §Part A — the AboutSection reads this via `import.meta.env.VITE_APP_VERSION`).
function readUiVersion(): string {
  try {
    const pkgRaw = readFileSync(
      path.resolve(__dirname, "./package.json"),
      "utf8",
    );
    const pkg = JSON.parse(pkgRaw) as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : "unknown";
  } catch {
    return "unknown";
  }
}

// Resolve the short git SHA at config-load time. Falls back to undefined
// when git is missing OR the working tree is not a git repo (release tarballs);
// the AboutSection then silently omits the build hash row per D-27.
function gitShortSha(): string | undefined {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
  } catch {
    return undefined;
  }
}

const uiVersion = readUiVersion();
const commit = gitShortSha();

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  // Inject build-time constants the React side can read via
  // `import.meta.env.VITE_APP_VERSION` / `VITE_APP_COMMIT` (D-27 / 03-06).
  // - VITE_APP_VERSION = `package.json` "version" field
  // - VITE_APP_COMMIT  = `git rev-parse --short HEAD`; undefined when
  //   git isn't reachable so AboutSection's optional render branch
  //   takes over.
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(uiVersion),
    "import.meta.env.VITE_APP_COMMIT": JSON.stringify(commit),
  },

  // Plan 05-04: Vite multi-entry — index.html (main window) +
  // tray-popover.html (the borderless React popover window built by
  // src-tauri/src/tray.rs::build_popover_window). Both bundles ship in
  // the same `dist/` so Tauri's resource resolver finds them via
  // WebviewUrl::App("tray-popover.html").
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        "tray-popover": path.resolve(__dirname, "tray-popover.html"),
      },
    },
  },

  // Tauri expects a fixed port and can fail if the port is busy
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Tauri generates a tauri.conf.json and Rust sources — don't watch them
      ignored: ["**/src-tauri/**"],
    },
  },
}));
