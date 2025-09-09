import fs from "fs";
import fetch from "node-fetch";

const gameIds = [ 2726539206 ];

const proxyUrl = "https://red-lotus.bloxyhdd.workers.dev/?url=";
const wait = ms => new Promise(r => setTimeout(r, ms));

async function fetchGameData(universeId) {
    const apiUrl = `https://games.roblox.com/v1/games?universeIds=${universeId}`;
    const res = await fetch(proxyUrl + encodeURIComponent(apiUrl));
    const data = await res.json();
    return data?.data?.[0];
}

async function fetchVotes(universeId) {
    const url = `https://games.roblox.com/v1/games/votes?universeIds=${universeId}`;
    const res = await fetch(proxyUrl + encodeURIComponent(url));
    const data = await res.json();
    const votes = data?.data?.[0];
    const total = votes.upVotes + votes.downVotes;
    return total > 0 ? Math.round((votes.upVotes / total) * 100) : 0;
}

async function fetchIcon(universeId) {
    const url = `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&size=768x432&format=Png&isCircular=false`;
    const res = await fetch(proxyUrl + encodeURIComponent(url));
    const data = await res.json();
    return data?.data?.[0]?.thumbnails?.[0]?.imageUrl ?? null;
}

(async () => {
    const allGames = [];

    for (const id of gameIds) {
        try {
            const game = await fetchGameData(id);
            if (!game) continue;

            const [icon, likeRatio] = await Promise.all([
                fetchIcon(id),
                fetchVotes(id)
            ]);

            allGames.push({
                id: game.id,
                rootPlaceId: game.rootPlaceId,
                name: game.name,
                playing: game.playing || 0,
                visits: game.visits || 0,
                likeRatio: likeRatio || 0,
                icon: icon || ""
            });

            await wait(200);
        } catch (err) {
            console.error(`Failed to fetch data for ${id}:`, err);
        }
    }

    allGames.sort((a, b) => b.playing - a.playing);

    fs.mkdirSync("public", { recursive: true });
    fs.writeFileSync("public/games.json", JSON.stringify({ games: allGames }, null, 2));
})();
