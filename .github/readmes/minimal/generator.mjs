#!/usr/bin/env node

function stripHash(color) {
  return String(color || '').replace(/^#/, '');
}

function clean(text) {
  return String(text || '').replace(/\r\n/g, '\n').trim();
}

function paragraphs(blocks) {
  return blocks.map(clean).filter(Boolean).join('\n\n');
}

function skillIconList(stackIcons) {
  const raw = [stackIcons?.languages, stackIcons?.frameworks]
    .filter(Boolean)
    .join(',');
  const seen = new Set();
  const icons = [];
  for (const icon of raw.split(',').map(s => s.trim()).filter(Boolean)) {
    const key = icon.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    icons.push(icon);
  }
  return icons;
}

function currentProjects(profile, owner) {
  if (Array.isArray(profile.focusProjects) && profile.focusProjects.length) {
    return profile.focusProjects
      .map(p => ({ name: p.name, url: p.url, tagline: p.tagline }))
      .filter(p => p.name);
  }
  return (profile.projects || [])
    .filter(p => p.name)
    .map(p => ({
      name: p.name,
      url: p.url || (p.repository ? `https://github.com/${owner}/${p.repository}` : ''),
      tagline: p.tagline,
    }));
}

export async function generate(ctx) {
  const user = ctx.user;
  const profile = ctx.config.profile || {};
  const who = profile.whoami || {};
  const accent = stripHash(profile.accent || '0e75b6');

  const displayName = clean(who.displayName || profile.displayName) || user;
  const role = clean(who.role);

  const greeting = role
    ? `Hey! I'm ${displayName}, a ${role} 👋`
    : `Hey! I'm ${displayName} 👋`;

  const bio = paragraphs([who.roleDescription, who.intro, who.experience, who.alsoGoodAt]);

  const projects = currentProjects(profile, ctx.repo.owner);
  const projectLines = projects
    .map(p => {
      const label = p.url
        ? `<a href="${p.url}"><strong>${p.name}</strong></a>`
        : `<strong>${p.name}</strong>`;
      return p.tagline ? `${label} - ${clean(p.tagline)}` : label;
    })
    .join('<br>\n');

  const stackBadges = (profile.techBadges || [])
    .filter(b => b.name)
    .map(b => {
      const label = clean(b.name).replace(/ /g, '%20');
      const color = stripHash(b.color) || accent;
      const logo = b.logo ? `&logo=${b.logo}&logoColor=white` : '';
      return `<img src="https://img.shields.io/badge/${label}-${color}?style=for-the-badge${logo}" alt="${clean(b.name)}" />`;
    })
    .join('\n');

  const icons = skillIconList(profile.stackIcons);
  const techStack = stackBadges
    ? `<h3 align="center">Tech Stack</h3>
<div align="center">
${stackBadges}
</div>`
    : icons.length
      ? `<h3 align="center">Tech Stack</h3>
<div align="center">
<img src="https://skillicons.dev/icons?i=${icons.join(',')}" height="60" />
</div>`
      : '';

  const contactBadges = (profile.links || [])
    .filter(l => l.url)
    .map(l => {
      const label = clean(l.label || l.url).replace(/ /g, '%20');
      const color = stripHash(l.color) || accent;
      const logo = l.logo ? `&logo=${l.logo}&logoColor=white` : '';
      return `<a href="${l.url}">
<img src="https://img.shields.io/badge/${label}-${color}?style=for-the-badge${logo}" alt="${clean(l.label)}" />
</a>`;
    })
    .join('\n');

  const contact = contactBadges
    ? `<h3 align="center">Contact</h3>
<div align="center">
${contactBadges}
</div>`
    : '';

  const header = `https://capsule-render.vercel.app/api?type=waving&height=100&section=header&color=${accent}`;
  const footer = `https://capsule-render.vercel.app/api?type=waving&height=100&section=footer&color=${accent}`;

  const parts = [
    `<p align="center">
  <img src="https://komarev.com/ghpvc/?username=${user}&label=Profile%20views&color=${accent}&style=flat" alt="${user}" />
</p>`,
    `<div>
<img width="100%" src="${header}" />
</div>`,
    `<h1 align="center">${greeting}</h1>`,
  ];

  if (bio || projectLines) {
    // A blank line would end the raw HTML block, so breaks must be explicit <br>.
    const inline = bio.replace(/\n{2,}/g, '<br><br>').replace(/\n/g, ' ');
    const inner = [inline, projectLines && `<strong>I'm currently working on:</strong><br>\n${projectLines}`]
      .filter(Boolean)
      .join('<br><br>\n');
    parts.push(`<p align="center">
${inner}
</p>`);
  }

  if (techStack) parts.push(techStack);
  if (contact) parts.push(contact);

  parts.push(`<div>
<img width="100%" src="${footer}" />
</div>`);

  // No timestamp on purpose: deterministic output means no commit on every cron run.
  const readme = `<!-- ${user} Profile | minimal -->
${parts.join('\n<br>\n')}
`;

  return { assets: [], readme };
}
