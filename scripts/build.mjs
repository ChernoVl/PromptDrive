import { build } from "esbuild";
import { mkdir, cp, rm } from "node:fs/promises";

async function main() {
  await rm("dist", { recursive: true, force: true });
  await mkdir("dist", { recursive: true });

  await build({
    entryPoints: ["src/content/main.ts"],
    bundle: true,
    outfile: "dist/content.js",
    format: "iife",
    platform: "browser",
    target: "chrome120",
    sourcemap: false,
    minify: false,
    alias: {
      "@shared": "./src/shared",
      "@content": "./src/content"
    }
  });

  await cp("src/manifest.json", "dist/manifest.json");
  await cp("src/content/styles.css", "dist/styles.css");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
