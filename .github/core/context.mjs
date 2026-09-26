#!/usr/bin/env node
// Plugin context builder — assembles the ctx object passed to every plugin's generate().

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PLUGIN_DIR = resolve(__dirname, '../readmes');
const REPO_ROOT = resolve(__dirname, '../..');

export function loadConfig() {
  const cfgPath = resolve(__dirname, '../config.json');
  if (!existsSync(cfgPath)) {
    throw new Error(`config.json not found at ${cfgPath}`);
  }
  const raw = readFileSync(cfgPath, 'utf-8');
  const cfg = JSON.parse(raw);

  if (!cfg.activeDesign || typeof cfg.activeDesign !== 'string') {
    throw new Error('config.json must contain "activeDesign" (string)');
  }
  if (!cfg.allowedDesigns || !Array.isArray(cfg.allowedDesigns)) {
    throw new Error('config.json must contain "allowedDesigns" (array of strings)');
  }
  if (!cfg.allowedDesigns.includes(cfg.activeDesign)) {
    throw new Error(`activeDesign "${cfg.activeDesign}" is not in allowedDesigns`);
  }
  if (cfg.repoOwner && typeof cfg.repoOwner !== 'string') {
    throw new Error('config.json "repoOwner" must be a string');
  }
  if (cfg.repoName && typeof cfg.repoName !== 'string') {
    throw new Error('config.json "repoName" must be a string');
  }
  return cfg;
}

export function buildContext(cfg) {
  const pluginDir = resolve(PLUGIN_DIR, cfg.activeDesign);
  const manifestPath = resolve(pluginDir, 'plugin.json');
  if (!existsSync(manifestPath)) {
    throw new Error(`plugin.json not found in ${pluginDir}`);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));

  const assetsDir = resolve(pluginDir, manifest.output?.assetsDir || 'assets');
  const readmePath = resolve(pluginDir, manifest.output?.readmePath || '../../README.md');

  return {
    config: cfg,
    user: process.env.GITHUB_USER || 'zpt0',
    token: process.env.GITHUB_TOKEN || undefined,
    paths: {
      pluginDir,
      assetsDir,
      readmePath,
      repoRoot: REPO_ROOT,
    },
    repo: {
      owner: cfg.repoOwner || process.env.GITHUB_OWNER || 'zpt0',
      name: cfg.repoName || process.env.GITHUB_REPO || 'zpt0',
    },
  };
}

export { __dirname as CORE_DIR };
