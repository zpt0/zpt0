#!/usr/bin/env node
// Minimal plugin.json schema validator — no external dependencies.
// Throws with a descriptive message on any validation failure.

export function validate(manifest, pluginDirName) {
  const errors = [];

  // name
  if (typeof manifest.name !== 'string' || !manifest.name) {
    errors.push('"name" must be a non-empty string');
  } else if (manifest.name !== pluginDirName) {
    errors.push(`"name" (${manifest.name}) must match the plugin directory name (${pluginDirName})`);
  }

  // version
  if (typeof manifest.version !== 'string' || !manifest.version) {
    errors.push('"version" must be a non-empty semver string');
  }

  // entry
  if (typeof manifest.entry !== 'string' || !manifest.entry) {
    errors.push('"entry" must be a non-empty string (path to the generator JS file)');
  }

  // output
  if (!manifest.output || typeof manifest.output !== 'object') {
    errors.push('"output" must be an object');
  } else {
    if (typeof manifest.output.assetsDir !== 'string' || !manifest.output.assetsDir) {
      errors.push('"output.assetsDir" must be a non-empty string');
    }
    if (typeof manifest.output.readmePath !== 'string' || !manifest.output.readmePath) {
      errors.push('"output.readmePath" must be a non-empty string');
    }
  }

  // capabilities
  if (manifest.capabilities && !Array.isArray(manifest.capabilities)) {
    errors.push('"capabilities" must be an array of strings');
  }

  if (errors.length > 0) {
    throw new Error(`Invalid plugin.json:\n  - ${errors.join('\n  - ')}`);
  }
}
