import fs from "fs";
import fetch from "node-fetch";

const gameIds = [6431757712, 7016268111, 6789766645, 6614175388, 6528524000, 6463581673, 7096838238, 7166097502, 7517851351, 7626153268, 7072328729, 6743843913, 7334543566, 6829990681, 7263505269, 7401898945, 7309264740, 7456466538, 3071634329, 4800580998, 7288212525, 2505069317, 5049176019, 2946951335, 7424382390, 7168683817, 7349366409
];

const proxyUrl = "https://workers-playground-white-credit-775c.bloxyhdd.workers.dev/?url=";

let wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getGameData(universeId) {
    try {
        let apiUrl = `https://games.roblox.com/v1/games?universeIds=${universeId}`;
        let response = await fetch(proxyUrl + encodeURIComponent(apiUrl));
        if (response.ok) {
            let json = await response.json();
            if (json.data && json.data.length > 0) {
                let game = json.data[0];
                return {
                    id: game.id,
                    playing: game.playing || 0,
                    visits: game.visits || 0
                };
            }
        } else if (response.status === 429) {
            await wait(500);
            return getGameData(universeId);
        }
    } catch (error) {
        console.error("Error fetching game data:", error);
    }
    return {
        id: universeId,
        playing: 0,
        visits: 0
    };
}

async function getVotesData(universeIds) {
    try {
        let apiUrl = `https://games.roblox.com/v1/games/votes?universeIds=${universeIds.join(",")}`;
        let response = await fetch(proxyUrl + encodeURIComponent(apiUrl));
        if (response.ok) {
            let json = await response.json();
            return json.data || [];
        } else if (response.status === 429) {
            await wait(500);
            return getVotesData(universeIds);
        }
    } catch (error) {
        console.error("Error fetching vote data:", error);
    }
    return [];
}

(async () => {
    const allGameData = await Promise.all(gameIds.map(id => getGameData(id)));
    const votesData = await getVotesData(gameIds);

    let totalPlayers = 0;
    let totalVisits = 0;

    for (const game of allGameData) {
        totalPlayers += game.playing;
        totalVisits += game.visits;
    }

    let filteredVotes = votesData.filter(v => (v.upVotes + v.downVotes) > 0);
    filteredVotes.sort((a, b) => {
        let aRatio = a.upVotes / (a.upVotes + a.downVotes);
        let bRatio = b.upVotes / (b.upVotes + b.downVotes);
        return aRatio - bRatio;
    });
    filteredVotes.shift();

    let totalRatio = 0;
    let count = 0;
    for (let vote of filteredVotes) {
        let total = vote.upVotes + vote.downVotes;
        if (total > 0) {
            let ratio = (vote.upVotes / total) * 100;
            totalRatio += ratio;
            count++;
        }
    }

    let averageRating = count > 0 ? Math.round(totalRatio / count) : 0;

    const result = {
        updatedAt: new Date().toISOString(),
        totalPlayers,
        totalVisits,
        averageRating,
        gamesCreated: gameIds.length,
        perGame: allGameData
    };

    fs.mkdirSync("public", { recursive: true });
    fs.writeFileSync("public/games.json", JSON.stringify(result, null, 2));
})();
