import fs from "fs";
import fetch from "node-fetch";

const gameIds = [8120277194, 8030001602, 6431757712, 7016268111, 6789766645, 6614175388, 6528524000, 6463581673, 7096838238, 7166097502, 7517851351, 7626153268, 7072328729, 6743843913, 7334543566, 6829990681, 7263505269, 7401898945, 7309264740, 7456466538, 3071634329, 4800580998, 7288212525, 2505069317, 5049176019, 2946951335, 7424382390, 7168683817, 7349366409, 8154106881, 7923536197
];

const proxyUrl = "https://workers-playground-white-credit-775c.bloxyhdd.workers.dev/?url=";
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
