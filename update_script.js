const fs = require("fs");
const https = require("https");

const DEVTO_API_KEY = process.env.DEVTO_API_KEY;
const README_FILE = "README.md";

const START_MARKER = "<!-- DEVTO-FOLLOWERS-COUNT:START -->";
const END_MARKER = "<!-- DEVTO-FOLLOWERS-COUNT:END -->";

if (!DEVTO_API_KEY) {
  throw new Error("Missing DEVTO_API_KEY");
}

function fetchFollowers(page = 1) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "dev.to",
        path: `/api/followers/users?page=${page}&per_page=1000`,
        method: "GET",
        headers: {
          "api-key": DEVTO_API_KEY,
          Accept: "application/vnd.forem.api-v1+json",
          "User-Agent": "miflow13-github-profile",
        },
      },
      (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(
              new Error(`DEV API returned ${res.statusCode}: ${data}`)
            );
            return;
          }

          resolve(JSON.parse(data));
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
}

async function getFollowerCount() {
  let page = 1;
  let count = 0;

  while (true) {
    const followers = await fetchFollowers(page);

    count += followers.length;

    if (followers.length < 1000) {
      return count;
    }

    page++;
  }
}

async function updateReadme() {
  const followerCount = await getFollowerCount();

  let readme = fs.readFileSync(README_FILE, "utf8");

  const replacement =
    `${START_MARKER}**${followerCount.toLocaleString()}** DEV.to followers${END_MARKER}`;

  const regex = new RegExp(
    `${START_MARKER}[\\s\\S]*?${END_MARKER}`,
    "g"
  );

  readme = readme.replace(regex, replacement);

  fs.writeFileSync(README_FILE, readme);

  console.log(`Updated DEV follower count: ${followerCount}`);
}

updateReadme().catch((error) => {
  console.error(error);
  process.exit(1);
});
