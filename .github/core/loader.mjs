#!/usr/bin/env node

import { loadConfig, buildContext } from './context.mjs';
import { validate } from './schema.mjs';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function checkAssetPathSafety(pluginDir, assetsDir) {
  if (!assetsDir.startsWith(pluginDir)) {
    throw new Error(`Security: assetsDir (${assetsDir}) must be inside pluginDir (${pluginDir})`);
  }
}

function saveAssets(ctx, assets) {
  for (const asset of assets) {
    const outPath = resolve(ctx.paths.assetsDir, asset.path);
    checkAssetPathSafety(ctx.paths.assetsDir, outPath);
    const outDir = dirname(outPath);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    writeFileSync(outPath, asset.content, 'utf-8');
    console.log(`  Asset: ${outPath}`);
  }
}

function writeReadme(ctx, readme) {
  const out = ctx.paths.readmePath;
  const dir = dirname(out);
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

  const assetsDir = resolve(ctx.paths.pluginDir, manifest.output?.assetsDir || 'assets');
  checkAssetPathSafety(ctx.paths.pluginDir, assetsDir);

  if (!existsSync(ctx.paths.assetsDir)) mkdirSync(ctx.paths.assetsDir, { recursive: true });

  const entryPath = resolve(ctx.paths.pluginDir, manifest.entry);
  if (!existsSync(entryPath)) {
    console.error(`Entry not found: ${entryPath}`);
    process.exit(1);
  }

  let plugin;
  try {
    const mod = await import(pathToFileURL(entryPath).href);
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

  if (result?.assets && Array.isArray(result.assets)) {
    saveAssets(ctx, result.assets);
  }

  if (typeof result?.readme === 'string') {
    writeReadme(ctx, result.readme);
  }

  console.log(`Done: ${ctx.config.activeDesign}`);
})();
