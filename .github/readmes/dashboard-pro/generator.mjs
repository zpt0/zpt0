#!/usr/bin/env node
// dashboard-pro — terminal/hacker theme profile with visual stats & activity widgets
// Plugin entry: exports async generate(ctx). Reuses core/api.mjs for data.

import { QUERY as API_QUERY, gql, fetchAllTimeCommits, processData, mockData } from '../../core/api.mjs';

const PROFILE_QUERY = API_QUERY.replace(
  '    name\n    createdAt',
  '    name\n    bio\n    location\n    websiteUrl\n    url\n    followers { totalCount }\n    createdAt'
);

const FONT_STACK = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;

const THEMES = {
  light: {
    bg: '#ffffff',
    border: '#d0d7de',
    track: '#ebedf0',
    ramp: ['#9be9a8', '#40c463', '#30a14e', '#216e39'],
    label: '#57606a',
    value: '#1f2328',
    accent: '#0e75b6',
    mono: '#24292f',
  },
  dark: {
    bg: '#0d1117',
    border: '#30363d',
    track: '#1f2328',
    ramp: ['#294f31', '#3c7c4c', '#47a347', '#5ed661'],
    label: '#8b949e',
    value: '#f0f6fc',
    accent: '#58a6ff',
    mono: '#e6edf3',
  },
};

const SOCIAL_COLORS = {
  github: '181717',
  twitter: '1da1f2',
  x: '000000',
  linkedin: '0a66c2',
  discord: '5865f2',
  mastodon: '6364ff',
  bluesky: '028bf7',
  email: 'ea4aaa',
};

function fmt(n) {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`;
}

function escSvg(s) {
  return String(s == null ? '' : s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
}

function escUrl(s) {
  if (!s) return '';
  try {
    const u = new URL(String(s));
    u.username = '';
    u.password = '';
    return u.toString();
  } catch {
    return '';
  }
}

function badgeUrl(label, colorHex, style = 'for-the-badge', logo = '') {
  const c = (colorHex || '555').replace('#', '');
  const enc = encodeURIComponent(label);
  let q = `?style=${style}&color=${c}`;
  if (logo) q += `&logo=${encodeURIComponent(logo)}`;
  return `https://img.shields.io/badge/${enc}-${c}${q}`;
}

// ----- SVG widgets -----

function statStrip(data, profile, theme) {
  const t = theme === 'dark' ? THEMES.dark : THEMES.light;
  const tiles = [
    { val: fmt(data.stats.totalRepos), label: 'REPOS' },
    { val: fmt(data.stats.totalStars), label: 'STARS' },
    { val: fmt(data.stats.totalForks), label: 'FORKS' },
    { val: fmt(data.stats.totalCommits), label: 'COMMITS' },
  ];
  if (profile._followers != null) {
    tiles.push({ val: fmt(profile._followers), label: 'FOLLOWERS' });
  }
  const W = 720;
  const H = 92;
  const tileW = 144;
  const n = tiles.length;
  const startX = (W - n * tileW) / 2;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Profile statistics">`;
  out += `<rect width="${W}" height="${H}" rx="8" fill="${t.bg}" stroke="${t.border}"/>`;
  for (let i = 0; i < n; i++) {
    const cx = startX + i * tileW + tileW / 2;
    const tile = tiles[i];
    out += `<text x="${cx}" y="52" text-anchor="middle" font-family="${FONT_STACK}" font-size="26" font-weight="700" fill="${t.value}">${escSvg(tile.val)}</text>`;
    out += `<text x="${cx}" y="72" text-anchor="middle" font-family="${FONT_STACK}" font-size="10" font-weight="600" fill="${t.label}" letter-spacing="1">${escSvg(tile.label)}</text>`;
    if (i < n - 1) {
      const sx = startX + (i + 1) * tileW;
      out += `<line x1="${sx}" y1="28" x2="${sx}" y2="82" stroke="${t.border}" stroke-width="0.8" stroke-dasharray="4 4"/>`;
    }
  }
  out += `<text x="16" y="18" font-family="${FONT_STACK}" font-size="9" fill="${t.label}" font-weight="700" letter-spacing="1">STATS</text>`;
  out += `</svg>`;
  return out;
}

function activityCalendar(data, theme) {
  const t = theme === 'dark' ? THEMES.dark : THEMES.light;
  const W = 700;
  const H = 110;
  const gridX = 40;
  const gridY = 16;
  const cell = 7;
  const gap = 3;
  const rows = 7;
  const step = cell + gap;
  const weeks = (data.calendar.weeks || []).slice(-53);
  const cols = weeks.length;

  let cells = '';
  for (let w = 0; w < cols; w++) {
    const days = (weeks[w] && weeks[w].contributionDays) || [];
    for (let d = 0; d < rows; d++) {
      const day = days[d];
      const count = day ? day.contributionCount : 0;
      const level = count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4;
      const fill = level === 0 ? t.track : t.ramp[level - 1];
      const cx = gridX + w * step;
      const cy = gridY + d * step;
      cells += `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" rx="1.5" fill="${fill}"/>`;
    }
  }

  const total = data.calendar.totalContributions || 0;
  const legend = [
    ['Less', t.track],
    [null, t.ramp[0]],
    [null, t.ramp[1]],
    [null, t.ramp[2]],
    [null, t.ramp[3]],
    ['More', t.ramp[3]],
  ];
  let leg = '';
  const legX = 10;
  const legY = H - 10;
  for (let i = 0; i < legend.length; i++) {
    const cx = legX + i * 12;
    leg += `<rect x="${cx}" y="${legY}" width="7" height="7" rx="1" fill="${legend[i][1]}"/>`;
    if (legend[i][0]) {
      leg += `<text x="${cx + 10}" y="${legY + 3}" font-family="${FONT_STACK}" font-size="7" fill="${t.label}" dominant-baseline="middle">${legend[i][0]}</text>`;
    }
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Contribution activity">`;
  svg += `<rect width="${W}" height="${H}" rx="8" fill="${t.bg}" stroke="${t.border}"/>`;
  svg += cells;
  svg += `<text x="${W - 12}" y="14" text-anchor="end" font-family="${FONT_STACK}" font-size="10" font-weight="600" fill="${t.label}">${fmt(total)} contributions · last year</text>`;
  svg += leg;
  svg += `</svg>`;
  return svg;
}

// ----- Markdown -----

function readReadme(ctx, data, profile) {
  const { repo, config } = ctx;
  const user = ctx.user;
  const accentHex = (profile.accent || '#0e75b6').replace('#', '');
  const base = `https://raw.githubusercontent.com/${repo.owner}/${repo.name}/main/.github/readmes/${config.activeDesign}/assets`;

  const displayName = profile.displayName || user;
  const role = profile.role || '';
  const tagline = profile.tagline || '';
  const location = profile.location || '';
  const website = profile.website || '';
  const bio = profile.bio || '';
  const currently = profile.currently || [];
  const socials = profile.socials || [];
  const projects = profile.focusProjects || data.topProjects || [];
  const techStack = profile.techStack || {};
  const whoami = profile.whoami || {};

  const suffix = [location ? `📍 ${location}` : '', website ? `🔗 ${website}` : '']
    .filter(Boolean).join(' · ');

  function escMd(s) {
    return String(s == null ? '' : s).replace(/\|/g, '\\|');
  }
  function escMdAttr(s) {
    return String(s == null ? '' : s).replace(/"/g, '%22');
  }

  function renderSkillBars(skills, label) {
    const maxBar = 12;
    let out = `### ${escMd(label)}\n\n`;
    out += '```text\n';
    for (const s of skills) {
      const filled = Math.max(1, Math.round((s.level / 5) * maxBar));
      const empty = maxBar - filled;
      const bar = '█'.repeat(filled) + '░'.repeat(empty);
      const stars = '★'.repeat(s.level) + '☆'.repeat(5 - s.level);
      out += `${escMd(s.name).padEnd(18)} ${bar}  ${stars}\n`;
    }
    out += '```\n\n';
    return out;
  }

  function renderTools(tools, label) {
    let out = `### ${escMd(label)}\n\n`;
    for (const t of tools) {
      out += `- **${escMd(t.name)}** — ${escMd(t.type)}\n`;
    }
    return out + '\n';
  }

  // ASCII banner
  const asciiBanner = `██████╗  █████╗ ███╗   ██╗████████╗██╗  ██╗
██╔══██╗██╔══██╗████╗  ██║╚══██╔══╝╚██╗██╔╝
██████╔╝███████║██╔██╗ ██║   ██║    ╚███╔╝ 
██╔═══╝ ██╔══██║██║╚██╗██║   ██║    ██╔██╗ 
██║     ██║  ██║██║ ╚████║   ██║   ██╔╝ ██╗
╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝`;

  let md = `<!-- ${displayName} profile | dashboard-pro | Generated ${new Date().toISOString()} -->\n\n`;

  md += `<p align="center">\n`;
  md += `  <img src="https://komarev.com/ghpvc/?username=${encodeURIComponent(user)}&label=Profile%20views&color=${accentHex}&style=flat" alt="Profile views" />\n`;
  md += `</p>\n\n`;

  // ASCII banner
  md += `\`\`\`\n${asciiBanner}\n\`\`\`\n\n`;

  // Header with role
  md += `# ${escMd(displayName)} ${escMd(role ? `• ${role}` : '')}\n`;
  if (suffix) md += `${suffix}\n`;
  md += `\n`;

  // Tagline
  if (tagline) md += `> ${escMd(tagline)}\n\n`;

  // Stats widget
  md += `## 📊 Stats\n`;
  md += `<picture>\n`;
  md += `  <source media="(prefers-color-scheme: dark)" srcset="${base}/stats-dark.svg">\n`;
  md += `  <img src="${base}/stats.svg" alt="Statistics" width="720" />\n`;
  md += `</picture>\n\n`;

  // whoami section (terminal style)
  if (whoami && Object.keys(whoami).length) {
    md += `## \`> whoami\`\n\n`;
    md += '```python\n';
    md += `class ${escMd(whoami.name || displayName)}:\n`;
    if (whoami.role) md += `    role        = "${escMd(whoami.role)}"\n`;
    if (whoami.focus && whoami.focus.length) md += `    focus       = ${JSON.stringify(whoami.focus)}\n`;
    if (whoami.languages && whoami.languages.length) md += `    languages   = ${JSON.stringify(whoami.languages)}\n`;
    if (whoami.hardware && whoami.hardware.length) md += `    hardware    = ${JSON.stringify(whoami.hardware)}\n`;
    if (whoami.security && whoami.security.length) md += `    security    = ${JSON.stringify(whoami.security)}\n`;
    if (whoami.status) md += `    status      = "${escMd(whoami.status)}"\n`;
    if (whoami.philosophy) md += `    philosophy  = "${escMd(whoami.philosophy)}"\n`;
    md += '```\n\n';
  }

  // Tech Stack - detailed categories
  if (techStack && Object.keys(techStack).length) {
    md += `## \`> skills --list\`\n\n`;
    for (const [category, skills] of Object.entries(techStack)) {
      if (!skills || !skills.length) continue;
      if (category === 'Frameworks & Tools') {
        md += renderTools(skills, category);
      } else {
        md += renderSkillBars(skills, category);
      }
    }
  }

  // Projects section (ls style)
  if (projects && projects.length) {
    md += `## \`> ls ./projects\`\n\n`;
    md += '```text\n';
    for (const p of projects) {
      const name = escMd(p.name);
      const desc = escMd(p.desc || '');
      const bar = '█'.repeat(16);
      md += `drwx------ ${name.padEnd(24)} ${bar}  <-- ${desc}\n`;
    }
    md += '```\n\n';
    md += `> 👾 **Stealth mode activated.** New projects are in the works. Details classified until release. Watch the repos.\n\n`;
  }

  // Activity widget
  md += `## \`> cat ./dev_log.txt\`\n\n`;
  md += `<picture>\n`;
  md += `  <source media="(prefers-color-scheme: dark)" srcset="${base}/calendar-dark.svg">\n`;
  md += `  <img src="${base}/calendar.svg" alt="Activity" width="700" />\n`;
  md += `</picture>\n\n`;

  if (currently.length) {
    md += '```text\n';
    for (const c of currently) md += `[+] ${escMd(c)}\n`;
    md += '[~] Sleep: optional. Coffee: mandatory.\n';
    md += '```\n\n';
  }

  // Social / connect
  if (socials.length) {
    md += `## \`> ifconfig connect\`\n\n`;
    md += `<p align="center">\n`;
    for (const s of socials) {
      if (/^(https?:)?\/\//.test(s.label || '')) {
        md += `[${escMd(s.url || s.label)}](${escUrl(s.url || s.label)})  `;
      } else {
        const color = SOCIAL_COLORS[s.label.toLowerCase()] || accentHex;
        const url = escUrl(s.url);
        const logo = s.label.toLowerCase() === 'github' ? 'github' : '';
        md += `<a href="${url}"><img src="${badgeUrl(s.label, color, 'for-the-badge', logo)}" alt="${escMdAttr(s.label)}" /></a>`;
      }
    }
    md += `\n</p>\n\n`;
  }

  // Footer quote
  md += `\`\`\`\n`;
  md += `╔═══════════════════════════════════════════════════════════╗\n`;
  md += `║  "Stay curious. Stay creative.                             ║\n`;
  md += `║   Always push the boundaries of what's possible."          ║\n`;
  md += `║                                              — ${escMd(displayName)}  ║\n`;
  md += `╚═══════════════════════════════════════════════════════════╝\n`;
  md += `\`\`\`\n\n`;

  md += `<hr/>\n<p align="center"><sub>${escMd(displayName)} · ${escMd(role)} · <a href="https://github.com/${repo.owner}">github.com/${repo.owner}</a></sub></p>\n`;

  return md;
}

// ----- Plugin entry -----

export async function generate(ctx) {
  const username = ctx.user;
  const token = ctx.token;
  const profile = Object.assign({}, ctx.config.profile || {});
  let data;

  if (token) {
    console.log(`Fetching data for @${username}...`);
    try {
      const user = await gql(token, PROFILE_QUERY, { login: username });
      const u = user.user;
      console.log(`  Account created: ${u.createdAt}`);
      const allTimeCommits = await fetchAllTimeCommits(username, token, u.createdAt);
      console.log(`  All-time commits: ${allTimeCommits}`);
      u._allTimeCommits = allTimeCommits;
      profile._followers = u.followers ? u.followers.totalCount : null;
      data = processData(u);
    } catch (e) {
      if (e.message.includes('403') || e.message.includes('401') || e.message.includes('Could not resolve to a User')) {
        console.log('  Extended query failed, falling back to basic repo data...');
        try {
          const user = await gql(token, API_QUERY, { login: username });
          const u = user.user;
          console.log(`  Account created: ${u.createdAt}`);
          const allTimeCommits = await fetchAllTimeCommits(username, token, u.createdAt);
          console.log(`  All-time commits: ${allTimeCommits}`);
          u._allTimeCommits = allTimeCommits;
          data = processData(u);
        } catch (e2) {
          console.error(`Error: ${e2.message}`);
          data = mockData();
        }
      } else {
        console.error(`Error: ${e.message}`);
        data = mockData();
      }
    }
  } else {
    console.log('No GITHUB_TOKEN — using mock data for preview.');
    data = mockData();
  }

  return {
    assets: [
      { path: 'stats.svg', content: statStrip(data, profile, 'light') },
      { path: 'stats-dark.svg', content: statStrip(data, profile, 'dark') },
      { path: 'calendar.svg', content: activityCalendar(data, 'light') },
      { path: 'calendar-dark.svg', content: activityCalendar(data, 'dark') },
    ],
    readme: readReadme(ctx, data, profile),
  };
}