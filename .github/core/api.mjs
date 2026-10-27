#!/usr/bin/env node

const GQL_URL = 'https://api.github.com/graphql';

export async function gql(token, query, variables) {
  const res = await fetch(GQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'zpt0-readme',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map(e => e.message).join(', '));
  return json.data;
}

export const QUERY = `
query ($login: String!) {
  user(login: $login) {
    name
    createdAt
    repositories(first: 100, ownerAffiliations: [OWNER, COLLABORATOR], isFork: false, orderBy: {field: STARGAZERS, direction: DESC}) {
      totalCount
      nodes {
        name
        description
        stargazerCount
        forkCount
        isPrivate
        primaryLanguage { name color }
        languages(first: 20, orderBy: {field: SIZE, direction: DESC}) {
          totalSize
          edges { size node { name color } }
        }
        url
      }
    }
    contributionsCollection {
      totalCommitContributions
      contributionCalendar {
        totalContributions
        weeks {
          contributionDays {
            contributionCount
            date
            weekday
          }
        }
      }
    }
  }
}`;

export const YEARLY_QUERY = `
query ($login: String!, $from: DateTime!, $to: DateTime!) {
  user(login: $login) {
    contributionsCollection(from: $from, to: $to) {
      totalCommitContributions
    }
  }
}`;

export async function fetchData(username, token) {
  return (await gql(token, QUERY, { login: username })).user;
}

export async function fetchAllTimeCommits(username, token, createdAt) {
  const startYear = new Date(createdAt).getFullYear();
  const now = new Date();
  const endYear = now.getFullYear();
  let total = 0;
  for (let yr = startYear; yr <= endYear; yr++) {
    const from = new Date(`${yr}-01-01T00:00:00Z`).toISOString();
    const to = yr === endYear ? now.toISOString() : new Date(`${yr+1}-01-01T00:00:00Z`).toISOString();
    const data = await gql(token, YEARLY_QUERY, { login: username, from, to });
    const c = data.user.contributionsCollection.totalCommitContributions;
    console.log(`  ${yr}: ${c} commits`);
    total += c;
  }
  return total;
}

export function mockData() {
  let contributions = 0;
  const weeks = [];
  for (let w = 0; w < 52; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const count = Math.floor(Math.random() * 8);
      contributions += count;
      const date = new Date(Date.now() - (52 - w) * 7 * 86400000 + d * 86400000);
      days.push({ contributionCount: count, date: date.toISOString().split('T')[0], weekday: d });
    }
    weeks.push({ contributionDays: days });
  }
  // Tokenless preview: the real public repos of @zpt0 (counts live, calendar random).
  const mockRepos = [
    { name: 'Clonecord', description: 'A simple tool to clone Discord servers.', stargazers: 4, forks: 2, primaryLanguage: { name: 'TypeScript', color: '#3178c6' }, fork: false, url: 'https://github.com/zpt0/Clonecord' },
    { name: 'Questcord', description: 'A Vencord plugin that automates Discord Quests with real-time progress tracking.', stargazers: 3, forks: 1, primaryLanguage: { name: 'TypeScript', color: '#3178c6' }, fork: false, url: 'https://github.com/zpt0/Questcord' },
    { name: 'DC-Lyra', description: 'A modern, modular Discord music bot with high-quality Lavalink audio and custom playlists.', stargazers: 2, forks: 2, primaryLanguage: { name: 'TypeScript', color: '#3178c6' }, fork: false, url: 'https://github.com/zpt0/DC-Lyra' },
    { name: 'Git2Page', description: 'Create and publish a dynamic portfolio by just providing your GitHub username.', stargazers: 1, forks: 0, primaryLanguage: { name: 'TypeScript', color: '#3178c6' }, fork: false, url: 'https://github.com/zpt0/Git2Page' },
    { name: 'COSTUM-BIO-PAGE-zpt0', description: 'A static bio page in the guns.lol style, zero dependencies.', stargazers: 1, forks: 0, primaryLanguage: { name: 'JavaScript', color: '#f1e05a' }, fork: false, url: 'https://github.com/zpt0/COSTUM-BIO-PAGE-zpt0' },
  ];
  return {
    stats: { totalStars: 11, totalForks: 5, totalRepos: 7, totalCommits: contributions },
    languages: [
      { name: 'TypeScript', color: '#3178c6', size: 68000, repos: 4, percentage: 68 },
      { name: 'JavaScript', color: '#f1e05a', size: 20000, repos: 2, percentage: 20 },
      { name: 'HTML', color: '#e34c26', size: 6000, repos: 1, percentage: 6 },
      { name: 'CSS', color: '#663399', size: 4000, repos: 1, percentage: 4 },
      { name: 'JSON', color: '#292929', size: 2000, repos: 2, percentage: 2 },
    ],
    topProjects: mockRepos.slice(0, 3),
    repos: mockRepos,
    calendar: { totalContributions: contributions, weeks },
  };
}

export function processData(user) {
  const repos = user.repositories.nodes;
  const totalStars = repos.reduce((s, r) => s + r.stargazerCount, 0);
  const totalForks = repos.reduce((s, r) => s + r.forkCount, 0);
  const totalRepos = user.repositories.totalCount;
  const totalCommits = user._allTimeCommits || user.contributionsCollection.totalCommitContributions;

  const langMap = {};
  for (const r of repos) {
    const edges = r.languages?.edges || [];
    for (const edge of edges) {
      const node = edge.node;
      if (!node) continue;
      const name = node.name;
      const size = edge.size || 0;
      if (!langMap[name]) langMap[name] = { name, color: node.color || '#555', size: 0, repos: 0 };
      langMap[name].size += size;
      langMap[name].repos += 1;
    }
  }
  const langArr = Object.values(langMap).sort((a, b) => b.size - a.size).slice(0, 10);
  const totalLangSize = langArr.reduce((s, l) => s + l.size, 0);
  const languages = langArr.map(l => ({ ...l, percentage: Math.round((l.size / (totalLangSize || 1)) * 100) }));

  const topProjects = repos
    .filter(r => r.name && r.description)
    .sort((a, b) => b.stargazerCount - a.stargazerCount)
    .slice(0, 3)
    .map(r => ({
      name: r.name,
      desc: r.description,
      stars: r.stargazerCount,
      forks: r.forkCount,
      lang: r.primaryLanguage ? r.primaryLanguage.name : null,
      langColor: r.primaryLanguage ? r.primaryLanguage.color : '#555',
      url: r.url,
    }));

  return {
    stats: { totalStars, totalForks, totalRepos, totalCommits },
    languages,
    topProjects,
    repos: repos.map(r => ({
      name: r.name,
      description: r.description,
      stargazers: r.stargazerCount,
      forks: r.forkCount,
      primaryLanguage: r.primaryLanguage,
      fork: r.isFork,
    })),
    calendar: user.contributionsCollection.contributionCalendar,
  };
}
