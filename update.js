const fs = require("fs");
const https = require("https");

// --------------------------------------------------
// Configuration
// --------------------------------------------------

const DEVTO_API_KEY = process.env.DEVTO_API_KEY;

const README_FILE = "README.md";
const BADGE_FILE = "assets/dev-followers.svg";

const START_MARKER = "<!-- DEVTO-FOLLOWERS-COUNT:START -->";
const END_MARKER = "<!-- DEVTO-FOLLOWERS-COUNT:END -->";

// --------------------------------------------------
// Validation
// --------------------------------------------------

if (!DEVTO_API_KEY) {
  console.error("❌ Missing DEVTO_API_KEY environment variable.");
  process.exit(1);
}

// --------------------------------------------------
// Fetch DEV followers
// --------------------------------------------------

function fetchFollowers(page = 1) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "dev.to",
      path: `/api/followers/users?page=${page}&per_page=1000`,
      method: "GET",
      headers: {
        "api-key": DEVTO_API_KEY,
        Accept: "application/vnd.forem.api-v1+json",
        "User-Agent": "miflow13-github-profile",
      },
    };

    const request = https.request(options, (response) => {
      let data = "";

      response.on("data", (chunk) => {
        data += chunk;
      });

      response.on("end", () => {
        if (response.statusCode !== 200) {
          reject(
            new Error(
              `DEV API returned ${response.statusCode}: ${data}`
            )
          );
          return;
        }

        try {
          const followers = JSON.parse(data);
          resolve(followers);
        } catch (error) {
          reject(
            new Error(`Could not parse DEV response: ${error.message}`)
          );
        }
      });
    });

    request.on("error", reject);
    request.end();
  });
}

async function getFollowerCount() {
  let page = 1;
  let totalFollowers = 0;

  while (true) {
    console.log(`📡 Fetching DEV followers page ${page}...`);

    const followers = await fetchFollowers(page);

    if (!Array.isArray(followers)) {
      throw new Error("Unexpected response from DEV API.");
    }

    totalFollowers += followers.length;

    console.log(
      `   Found ${followers.length} followers on page ${page}.`
    );

    // Last page
    if (followers.length < 1000) {
      break;
    }

    page++;
  }

  return totalFollowers;
}

// --------------------------------------------------
// Badge generator
// --------------------------------------------------

function createDevBadge(followerCount) {
  const formattedCount = followerCount.toLocaleString("en-US");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg"
  width="190"
  height="32"
  viewBox="0 0 190 32"
  role="img"
  aria-label="DEV followers: ${formattedCount}">

  <title>DEV followers: ${formattedCount}</title>

  <defs>
    <linearGradient id="followersGradient" x1="0" x2="1">
      <stop offset="0%" stop-color="#3b49df"/>
      <stop offset="100%" stop-color="#7c3aed"/>
    </linearGradient>

    <clipPath id="roundedBadge">
      <rect width="190" height="32" rx="7"/>
    </clipPath>
  </defs>

  <g clip-path="url(#roundedBadge)">
    <!-- DEV section -->
    <rect
      width="56"
      height="32"
      fill="#0d0d0d"
    />

    <!-- Follower count section -->
    <rect
      x="56"
      width="134"
      height="32"
      fill="url(#followersGradient)"
    />
  </g>

  <!-- DEV text -->
  <text
    x="28"
    y="21"
    fill="#ffffff"
    text-anchor="middle"
    font-family="Verdana, Geneva, sans-serif"
    font-size="12"
    font-weight="700"
  >
    DEV
  </text>

  <!-- Followers -->
  <text
    x="123"
    y="21"
    fill="#ffffff"
    text-anchor="middle"
    font-family="Verdana, Geneva, sans-serif"
    font-size="11"
  >
    ${formattedCount} followers
  </text>
</svg>`;

  fs.mkdirSync("assets", {
    recursive: true,
  });

  fs.writeFileSync(BADGE_FILE, svg.trim());

  console.log(
    `🎨 Generated ${BADGE_FILE} with ${formattedCount} followers.`
  );
}

// --------------------------------------------------
// README updater
// --------------------------------------------------

function updateReadmeFollowerCount(followerCount) {
  if (!fs.existsSync(README_FILE)) {
    throw new Error(`${README_FILE} could not be found.`);
  }

  let readme = fs.readFileSync(README_FILE, "utf8");

  const startIndex = readme.indexOf(START_MARKER);
  const endIndex = readme.indexOf(END_MARKER);

  if (startIndex === -1 || endIndex === -1) {
    throw new Error(
      `README follower markers are missing.

Add this somewhere to README.md:

${START_MARKER}**0** DEV.to followers${END_MARKER}`
    );
  }

  if (endIndex < startIndex) {
    throw new Error("README follower markers are in the wrong order.");
  }

  const formattedCount = followerCount.toLocaleString("en-US");

  const replacement =
    `${START_MARKER}` +
    `**${formattedCount}** DEV.to followers` +
    `${END_MARKER}`;

  const before = readme.slice(0, startIndex);

  const after = readme.slice(
    endIndex + END_MARKER.length
  );

  readme = before + replacement + after;

  fs.writeFileSync(README_FILE, readme);

  console.log(
    `📝 README updated to ${formattedCount} DEV followers.`
  );
}

// --------------------------------------------------
// Main
// --------------------------------------------------

async function main() {
  try {
    console.log("🚀 Updating DEV follower stats...\n");

    const followerCount = await getFollowerCount();

    console.log(
      `\n✨ Total DEV followers: ${followerCount.toLocaleString("en-US")}\n`
    );

    createDevBadge(followerCount);
    updateReadmeFollowerCount(followerCount);

    console.log("\n✅ DEV follower update complete!");
  } catch (error) {
    console.error("\n❌ Update failed:");
    console.error(error.message);

    process.exit(1);
  }
}

main();
