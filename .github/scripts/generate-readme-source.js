#!/usr/bin/env node
// Generates readme.source.md from profile.config.json + template
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(process.cwd());
const config = JSON.parse(fs.readFileSync(path.join(rootDir, '.github/profile.config.json'), 'utf-8'));
const template = fs.readFileSync(path.join(rootDir, '.github/readme.source.template.md'), 'utf-8');

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) };
}

function resolvePath(obj, pathStr) {
  return pathStr.split(/[\.\[\]]/).filter(Boolean).reduce((o, k) => o != null ? o[k] : undefined, obj);
}

const PROJECTS_MODE = config.projects.mode;

const TOKEN_MAP = {
  'HERO_NAME': 'profile.name',
  'HERO_TITLE': 'profile.heroTitle',
  'HERO_TAGLINE': 'profile.heroTagline',
  'HERO_TAG_0_LABEL': 'profile.heroTags[0].label',
  'HERO_TAG_0_COLOR': 'profile.heroTags[0].color',
  'HERO_TAG_1_LABEL': 'profile.heroTags[1].label',
  'HERO_TAG_1_COLOR': 'profile.heroTags[1].color',
  'HERO_TAG_2_LABEL': 'profile.heroTags[2].label',
  'HERO_TAG_2_COLOR': 'profile.heroTags[2].color',
  'HERO_TAG_3_LABEL': 'profile.heroTags[3].label',
  'HERO_TAG_3_COLOR': 'profile.heroTags[3].color',
  'PROFILE_HEADING': 'profile.profileHeading',
  'PROFILE_DESCRIPTION': 'profile.profileDescription',
  'EXPERIENCE_0': 'experience[0]',
  'EXPERIENCE_1': 'experience[1]',
  'EXPERIENCE_2': 'experience[2]',
  'TECH_0_LABEL': 'profile.techStack[0].label',
  'TECH_0_COLOR': 'profile.techStack[0].color',
  'TECH_1_LABEL': 'profile.techStack[1].label',
  'TECH_1_COLOR': 'profile.techStack[1].color',
  'TECH_2_LABEL': 'profile.techStack[2].label',
  'TECH_2_COLOR': 'profile.techStack[2].color',
  'TECH_3_LABEL': 'profile.techStack[3].label',
  'TECH_3_COLOR': 'profile.techStack[3].color',
  'TECH_4_LABEL': 'profile.techStack[4].label',
  'TECH_4_COLOR': 'profile.techStack[4].color',
  'TECH_5_LABEL': 'profile.techStack[5].label',
  'TECH_5_COLOR': 'profile.techStack[5].color',
  'TECH_6_LABEL': 'profile.techStack[6].label',
  'TECH_6_COLOR': 'profile.techStack[6].color',
  'TECH_7_LABEL': 'profile.techStack[7].label',
  'TECH_7_COLOR': 'profile.techStack[7].color',
};

// Project tokens only used in custom mode
const PROJECT_TOKENS = {
  'PROJECT_0_NAME': 'projects.custom[0].name',
  'PROJECT_0_SUBTITLE': 'projects.custom[0].subtitle',
  'PROJECT_0_DESC': 'projects.custom[0].description',
  'PROJECT_0_TAG_0_LABEL': 'projects.custom[0].tech[0].label',
  'PROJECT_0_TAG_0_COLOR': 'projects.custom[0].tech[0].color',
  'PROJECT_1_NAME': 'projects.custom[1].name',
  'PROJECT_1_SUBTITLE': 'projects.custom[1].subtitle',
  'PROJECT_1_DESC': 'projects.custom[1].description',
  'PROJECT_1_TAG_0_LABEL': 'projects.custom[1].tech[0].label',
  'PROJECT_1_TAG_0_COLOR': 'projects.custom[1].tech[0].color',
  'PROJECT_2_NAME': 'projects.custom[2].name',
  'PROJECT_2_SUBTITLE': 'projects.custom[2].subtitle',
  'PROJECT_2_DESC': 'projects.custom[2].description',
  'PROJECT_2_TAG_0_LABEL': 'projects.custom[2].tech[0].label',
  'PROJECT_2_TAG_0_COLOR': 'projects.custom[2].tech[0].color',
};

let result = template;

// Strip section not matching displayMode
const DISPLAY_MODE = config.displayMode.mode;
if (DISPLAY_MODE === 'profile') {
  result = result.replace(/<!-- COMPONENTS_MODE -->[\s\S]*?<!-- END_COMPONENTS_MODE -->/g, '');
  result = result.replace(/<!-- PROFILE_MODE -->([\s\S]*?)<!-- END_PROFILE_MODE -->/g, '$1');
} else {
  result = result.replace(/<!-- PROFILE_MODE -->[\s\S]*?<!-- END_PROFILE_MODE -->/g, '');
  result = result.replace(/<!-- COMPONENTS_MODE -->([\s\S]*?)<!-- END_COMPONENTS_MODE -->/g, '$1');
}

// Strip project aura block if projects mode is not custom
if (PROJECTS_MODE !== 'custom') {
  result = result.replace(/```aura width=800 height=185 link="\{\{PROFILE_URL\}\}"[\s\S]*?```\s*/g, '');
}

// Merge project tokens if custom mode
const activeTokens = { ...TOKEN_MAP };
if (PROJECTS_MODE === 'custom') {
  Object.assign(activeTokens, PROJECT_TOKENS);
}

// Replace {{BORDER:TOKEN:ALPHA}} -> rgba(r,g,b,alpha)
result = result.replace(/\{\{BORDER:(\w+):([\d.]+)\}\}/g, (match, token, alpha) => {
  const configPath = activeTokens[token];
  if (!configPath) return match;
  const hex = resolvePath(config, configPath);
  if (!hex || typeof hex !== 'string') return match;
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${alpha})`;
});

// Replace {{TOKEN}} tokens
for (const [token, configPath] of Object.entries(activeTokens)) {
  const value = resolvePath(config, configPath);
  if (value != null) {
    result = result.replace(new RegExp(`\\{\\{${token}\\}\\}`, 'g'), String(value));
  }
}

// Replace {{*_COLOR_LIGHT}} tokens (use same color)
result = result.replace(/\{\{(\w+_TAG_\d+_COLOR_LIGHT)\}\}/g, (match, token) => {
  const baseToken = token.replace('_LIGHT', '');
  const configPath = activeTokens[baseToken];
  if (!configPath) return match;
  return resolvePath(config, configPath) || match;
});

// Replace {{PROFILE_URL}}
const profileUrl = `https://github.com/${config.github.username}`;
result = result.replace(/\{\{PROFILE_URL\}\}/g, profileUrl);

// Write output
const outPath = path.join(rootDir, 'readme.source.md');
fs.writeFileSync(outPath, result, 'utf-8');
console.log(`  Generated: ${outPath}`);
