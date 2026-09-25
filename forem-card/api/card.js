const FOREM_API = "https://dev.to/api";
const ACCEPT = "application/vnd.forem.api-v1+json";
const USER_AGENT = "forem-readme-card/1.0";

const THEMES = {
  dark: {
    bg: "#0d1117",
    panel: "#161b22",
    panel2: "#10151d",
    border: "#30363d",
    text: "#f0f6fc",
    muted: "#8b949e",
    accent: "#a78bfa",
    pink: "#f472b6",
    blue: "#60a5fa",
    green: "#34d399",
    orange: "#fb923c",
    tagBg: "#21262d"
  },
  light: {
    bg: "#ffffff",
    panel: "#f6f8fa",
    panel2: "#ffffff",
    border: "#d0d7de",
    text: "#1f2328",
    muted: "#656d76",
    accent: "#7c3aed",
    pink: "#db2777",
    blue: "#2563eb",
    green: "#059669",
    orange: "#ea580c",
    tagBg: "#eff2f5"
  }
};

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }

  const username = normalizeUsername(req.query.username || "miflow13");
  const themeName = req.query.theme === "light" ? "light" : "dark";
  const theme = THEMES[themeName];

  if (!username) {
    return sendErrorCard(res, theme, "Invalid DEV username", 400);
  }

  try {
    const headers = {
      Accept: ACCEPT,
      "User-Agent": USER_AGENT
    };

    const [userResponse, articlesResponse] = await Promise.all([
      fetch(`${FOREM_API}/users/${encodeURIComponent(username)}`, { headers }),
      fetch(
        `${FOREM_API}/articles?username=${encodeURIComponent(username)}&state=all&per_page=1000`,
        { headers }
      )
    ]);

    if (userResponse.status === 404) {
      return sendErrorCard(res, theme, `DEV user @${username} was not found`, 404);
    }

    if (!userResponse.ok || !articlesResponse.ok) {
      throw new Error(
        `Forem request failed: user=${userResponse.status}, articles=${articlesResponse.status}`
      );
    }

    const user = await userResponse.json();
    const articles = await articlesResponse.json();

    const stats = aggregateArticles(Array.isArray(articles) ? articles : []);
    const avatarDataUri = await fetchImageDataUri(user.profile_image);

    const svg = renderCard({
      user,
      username,
      stats,
      avatarDataUri,
      theme,
      themeName
    });

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, max-age=900, s-maxage=900, stale-while-revalidate=86400"
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(svg);
  } catch (error) {
    console.error("[forem-card]", error);
    return sendErrorCard(res, theme, "DEV profile is temporarily unavailable", 502);
  }
};

function normalizeUsername(value) {
  const username = String(Array.isArray(value) ? value[0] : value)
    .trim()
    .replace(/^@/, "");

  if (!/^[a-zA-Z0-9_-]{1,50}$/.test(username)) return null;
  return username;
}

function aggregateArticles(articles) {
  let reactions = 0;
  let comments = 0;
  let readingMinutes = 0;
  const tagCounts = new Map();

  for (const article of articles) {
    reactions += Number(article.public_reactions_count || 0);
    comments += Number(article.comments_count || 0);
    readingMinutes += Number(article.reading_time_minutes || 0);

    const tags = Array.isArray(article.tag_list)
      ? article.tag_list
      : String(article.tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean);

    for (const tag of tags) {
      const normalized = String(tag).toLowerCase();
      tagCounts.set(normalized, (tagCounts.get(normalized) || 0) + 1);
    }
  }

  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([tag]) => tag);

  return {
    posts: articles.length,
    reactions,
    comments,
    readingMinutes,
    topTags
  };
}

async function fetchImageDataUri(url) {
  if (!url || typeof url !== "string" || !url.startsWith("https://")) return null;

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT }
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/png";
    if (!contentType.startsWith("image/")) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 1_500_000) return null;

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function renderCard({ user, username, stats, avatarDataUri, theme, themeName }) {
  const name = escapeXml(user.name || username);
  const handle = escapeXml(`@${user.username || username}`);
  const summary = escapeXml(
    truncate(
      user.summary || "Writing, building, and sharing with the DEV Community.",
      76
    )
  );
  const location = escapeXml(truncate(user.location || "", 28));
  const joined = escapeXml(formatJoinedDate(user.joined_at));
  const profileUrl = `https://dev.to/${encodeURIComponent(username)}`;
  const topTags = stats.topTags.length ? stats.topTags : ["devcommunity"];

  const tagsSvg = renderTags(topTags, theme);
  const avatar = avatarDataUri
    ? `<image href="${avatarDataUri}" x="34" y="34" width="116" height="116" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`
    : `<circle cx="92" cy="92" r="58" fill="url(#avatarGradient)"/>
       <text x="92" y="108" text-anchor="middle" font-size="48" font-weight="700" fill="#ffffff">${escapeXml(
         (user.name || username).slice(0, 1).toUpperCase()
       )}</text>`;

  const meta = [location, joined].filter(Boolean).join("  •  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="280" viewBox="0 0 800 280" role="img" aria-labelledby="title desc">
  <title id="title">${name}'s DEV Community profile card</title>
  <desc id="desc">${stats.posts} posts, ${stats.reactions} reactions, ${stats.comments} comments, and ${stats.readingMinutes} minutes of published reading time.</desc>
  <defs>
    <linearGradient id="bgGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.bg}"/>
      <stop offset="100%" stop-color="${theme.panel2}"/>
    </linearGradient>
    <linearGradient id="avatarGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${theme.accent}"/>
      <stop offset="100%" stop-color="${theme.pink}"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-20%" width="120%" height="150%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="${themeName === "dark" ? "0.28" : "0.12"}"/>
    </filter>
    <clipPath id="avatarClip"><circle cx="92" cy="92" r="58"/></clipPath>
  </defs>

  <rect x="1" y="1" width="798" height="278" rx="20" fill="url(#bgGradient)" stroke="${theme.border}" filter="url(#shadow)"/>

  <circle cx="92" cy="92" r="62" fill="none" stroke="${theme.accent}" stroke-width="3" opacity="0.9"/>
  ${avatar}

  <text x="178" y="52" fill="${theme.text}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" font-size="27" font-weight="700">${name}</text>
  <text x="178" y="78" fill="${theme.muted}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" font-size="16" font-weight="600">${handle}</text>

  <rect x="640" y="30" width="126" height="38" rx="12" fill="${theme.panel}" stroke="${theme.border}"/>
  <rect x="653" y="40" width="34" height="19" rx="3" fill="${theme.text}"/>
  <text x="670" y="54" text-anchor="middle" fill="${theme.bg}" font-family="Arial,sans-serif" font-size="10" font-weight="800">DEV</text>
  <text x="698" y="54" fill="${theme.text}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" font-size="12" font-weight="600">Community</text>

  <text x="178" y="111" fill="${theme.text}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" font-size="15">${summary}</text>
  ${meta ? `<text x="178" y="137" fill="${theme.muted}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" font-size="12">${meta}</text>` : ""}

  ${statCard(178, 157, "Posts", formatNumber(stats.posts), theme.blue, theme)}
  ${statCard(326, 157, "Reactions", formatNumber(stats.reactions), theme.pink, theme)}
  ${statCard(474, 157, "Comments", formatNumber(stats.comments), theme.green, theme)}
  ${statCard(622, 157, "Read min", formatNumber(stats.readingMinutes), theme.orange, theme)}

  <text x="34" y="210" fill="${theme.muted}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" font-size="12" font-weight="700">TOP TAGS</text>
  ${tagsSvg}

  <line x1="34" y1="242" x2="766" y2="242" stroke="${theme.border}"/>
  <text x="34" y="264" fill="${theme.muted}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" font-size="11">Live stats from the Forem API • refreshes every ~15 min</text>
  <a href="${profileUrl}" target="_blank">
    <text x="766" y="264" text-anchor="end" fill="${theme.accent}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" font-size="12" font-weight="700">dev.to/${escapeXml(username)} ↗</text>
  </a>
</svg>`;
}

function statCard(x, y, label, value, accent, theme) {
  return `
  <rect x="${x}" y="${y}" width="136" height="44" rx="11" fill="${theme.panel}" stroke="${theme.border}"/>
  <circle cx="${x + 18}" cy="${y + 22}" r="6" fill="${accent}"/>
  <text x="${x + 32}" y="${y + 20}" fill="${theme.text}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" font-size="15" font-weight="700">${escapeXml(value)}</text>
  <text x="${x + 32}" y="${y + 35}" fill="${theme.muted}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" font-size="10">${escapeXml(label)}</text>`;
}

function renderTags(tags, theme) {
  let x = 105;
  const y = 196;
  let output = "";

  for (const rawTag of tags.slice(0, 5)) {
    const tag = truncate(rawTag, 16);
    const width = Math.max(72, 24 + tag.length * 7.4);
    if (x + width > 766) break;

    output += `
      <rect x="${x}" y="${y}" width="${width}" height="27" rx="13.5" fill="${theme.tagBg}" stroke="${theme.border}"/>
      <text x="${x + 12}" y="${y + 18}" fill="${theme.text}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" font-size="11" font-weight="600">#${escapeXml(tag)}</text>`;

    x += width + 8;
  }

  return output;
}

function sendErrorCard(res, theme, message, status) {
  const safe = escapeXml(message);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="180" viewBox="0 0 800 180" role="img">
  <rect x="1" y="1" width="798" height="178" rx="20" fill="${theme.bg}" stroke="${theme.border}"/>
  <rect x="34" y="44" width="48" height="28" rx="5" fill="${theme.text}"/>
  <text x="58" y="63" text-anchor="middle" fill="${theme.bg}" font-family="Arial,sans-serif" font-size="14" font-weight="800">DEV</text>
  <text x="34" y="108" fill="${theme.text}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" font-size="22" font-weight="700">Forem README Card</text>
  <text x="34" y="137" fill="${theme.muted}" font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif" font-size="14">${safe}</text>
</svg>`;

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).send(svg);
}

function formatJoinedDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `Joined ${new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).format(date)}`;
}

function formatNumber(value) {
  const number = Number(value || 0);
  if (number < 1000) return String(number);
  if (number < 1_000_000) {
    return `${(number / 1000).toFixed(number >= 10_000 ? 0 : 1).replace(".0", "")}K`;
  }
  return `${(number / 1_000_000).toFixed(number >= 10_000_000 ? 0 : 1).replace(".0", "")}M`;
}

function truncate(value, maxLength) {
  const string = String(value || "").replace(/\s+/g, " ").trim();
  if (string.length <= maxLength) return string;
  return `${string.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
