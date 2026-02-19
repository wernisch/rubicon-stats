import fs from "fs";
import fetch from "node-fetch";

const gameIds = [
        5991139138, 7577218041, 6936093513, 5374476232, 13716027142, 4759813126, 1680246327, 4410725758, 5134533546, 7429991374, 7629331599, 7745789104, 8118561812,
        8695949193, // Mythic Tower Defense
        8470980958, // Build a Mech
        9098570654, // Apocalypse
];


const proxyUrl = "https://rubicon.bloxyhdd.workers.dev/?url=";
const BATCH_SIZE = 75;
const REQUEST_TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 4;

const wait = (ms) => new Promise(r => setTimeout(r, ms));

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function backoffMs(attempt) {
  const base = Math.min(4000, 250 * Math.pow(2, attempt - 1));
  return base / 2 + Math.random() * base / 2;
}

function parseRetryAfter(v) {
  if (!v) return null;
  const s = Number(v);
  if (!Number.isNaN(s)) return Math.max(0, s * 1000);
  const d = Date.parse(v);
  if (!Number.isNaN(d)) return Math.max(0, d - Date.now());
  return null;
}

function wrap(url) {
  return proxyUrl ? proxyUrl + encodeURIComponent(url) : url;
}

async function fetchWithRetry(url, init = {}) {
  let lastErr, res;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      res = await fetch(url, { ...init, signal: controller.signal, headers: { ...(init.headers || {}), Origin: "null" } });
      clearTimeout(timer);

      if (res.status === 429 && attempt < MAX_ATTEMPTS) {
        const ra = parseRetryAfter(res.headers.get("Retry-After"));
        await wait(ra ?? backoffMs(attempt));
        continue;
      }
      if (res.status >= 500 && res.status < 600 && attempt < MAX_ATTEMPTS) {
        await wait(backoffMs(attempt));
        continue;
      }
      return res;
    } catch (e) {
      lastErr = e;
      if (attempt === MAX_ATTEMPTS) break;
      await wait(backoffMs(attempt));
    }
  }
  throw lastErr || new Error(`Failed to fetch ${url}`);
}

async function fetchGamesBatch(ids) {
  const url = wrap(`https://games.roblox.com/v1/games?universeIds=${ids.join(",")}`);
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`games ${res.status}`);
  const data = await res.json();
  const map = new Map();
  for (const g of data?.data || []) map.set(g.id, g);
  return map;
}

async function fetchVotesBatch(ids) {
  const url = wrap(`https://games.roblox.com/v1/games/votes?universeIds=${ids.join(",")}`);
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`votes ${res.status}`);
  const data = await res.json();
  const map = new Map();
  for (const v of data?.data || []) {
    const up = v.upVotes || 0;
    const down = v.downVotes || 0;
    const total = up + down;
    const likeRatio = total > 0 ? Math.round((up / total) * 100) : 0;
    map.set(v.id, likeRatio);
  }
  return map;
}

async function fetchIconsBatch(ids) {
  const url = wrap(`https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${ids.join(",")}&size=768x432&format=Png&isCircular=false`);
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`thumbs ${res.status}`);
  const data = await res.json();
  const map = new Map();
  for (const row of data?.data || []) {
    const uni = row.universeId ?? row.targetId;
    const img = row?.thumbnails?.[0]?.imageUrl ?? "";
    map.set(uni, img);
  }
  return map;
}

(async () => {
  const allGames = [];
  const batches = chunk(gameIds, BATCH_SIZE);

  for (const ids of batches) {
    try {
      const [gamesMap, votesMap, iconsMap] = await Promise.all([
        fetchGamesBatch(ids),
        fetchVotesBatch(ids),
        fetchIconsBatch(ids)
      ]);

      for (const id of ids) {
        const game = gamesMap.get(id);
        if (!game) continue;

        allGames.push({
          id: game.id,
          rootPlaceId: game.rootPlaceId,
          name: game.name,
          playing: game.playing || 0,
          visits: game.visits || 0,
          likeRatio: votesMap.get(id) ?? 0,
          icon: iconsMap.get(id) ?? ""
        });
      }

      await wait(300);
    } catch (err) {
      console.error(`Batch failed for ids [${ids.join(",")}]:`, err);
    }
  }

  allGames.sort((a, b) => b.playing - a.playing);

  fs.mkdirSync("public", { recursive: true });
  fs.writeFileSync("public/games.json", JSON.stringify({ games: allGames }, null, 2));
})();
