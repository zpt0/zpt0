#!/usr/bin/env node
// Plugin loader — reads config.json, validates the active plugin, runs it.
// This is the ONLY entry point the workflow calls.

import { loadConfig, buildContext } from './context.js';
import { validate } from './schema.js';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function checkAssetPathSafety(pluginDir, assetsDir) {
  if (!assetsDir.startsWith(pluginDir)) {
    throw new Error(`Security: assetsDir (${assetsDir}) must be inside pluginDir (${pluginDir})`);
  }
}

function saveAssets(ctx, assets) {
  for (const asset of assets) {
    const outPath = resolve(ctx.paths.assetsDir, asset.path);
    checkAssetPathSafety(ctx.paths.assetsDir, outPath);
    const outDir = outPath.substring(0, outPath.lastIndexOf('/'));
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, asset.content, 'utf-8');
    console.log(`  Asset: ${outPath}`);
  }
}

function writeReadme(ctx, readme) {
  const out = ctx.paths.readmePath;
  const dir = out.substring(0, out.lastIndexOf('/'));
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(out, readme, 'utf-8');
  console.log(`  README: ${out}`);
}

(async () => {
  let ctx;
  try {
    const cfg = loadConfig();
    ctx = buildContext(cfg);
    console.log(`Active design: ${cfg.activeDesign}`);
    console.log(`Plugin dir:   ${ctx.paths.pluginDir}`);
  } catch (e) {
    console.error(`Config/Context error: ${e.message}`);
    process.exit(1);
  }

  // Validate plugin manifest
  const manifestPath = resolve(ctx.paths.pluginDir, 'plugin.json');
  if (!existsSync(manifestPath)) {
    console.error(`plugin.json not found: ${manifestPath}`);
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  try {
    validate(manifest, ctx.config.activeDesign);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  // Security: assetsDir must stay inside pluginDir
  const assetsDir = resolve(ctx.paths.pluginDir, manifest.output?.assetsDir || 'assets');
  checkAssetPathSafety(ctx.paths.pluginDir, assetsDir);

  // Ensure output dirs exist
  if (!existsSync(ctx.paths.assetsDir)) mkdirSync(ctx.paths.assetsDir, { recursive: true });

  // Load and run the plugin
  const entryPath = resolve(ctx.paths.pluginDir, manifest.entry);
  if (!existsSync(entryPath)) {
    console.error(`Entry not found: ${entryPath}`);
    process.exit(1);
  }

  // Use direct require to support ESM/CJS in plugins
  let plugin;
  try {
    const mod = await import(entryPath);
    plugin = mod;
  } catch (e) {
    console.error(`Failed to load plugin at ${entryPath}: ${e.message}`);
    process.exit(1);
  }

  if (typeof plugin.generate !== 'function') {
    console.error(`Plugin at ${entryPath} must export a generate(ctx) function`);
    process.exit(1);
  }

  console.log(`Running plugin: ${ctx.config.activeDesign}@${manifest.version}...`);

  let result;
  try {
    result = await plugin.generate(ctx);
  } catch (e) {
    console.error(`Plugin error: ${e.message}`);
    process.exit(1);
  }

  // Write assets
  if (result?.assets && Array.isArray(result.assets)) {
    saveAssets(ctx, result.assets);
  }

  // Write README
  if (typeof result?.readme === 'string') {
    writeReadme(ctx, result.readme);
  }

  console.log(`Done: ${ctx.config.activeDesign}`);
})();
