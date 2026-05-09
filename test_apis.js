const https = require('https');

async function fetchAllOrigins(url) {
    return new Promise((resolve, reject) => {
        https.get(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json.contents);
                } catch(e) { reject(e); }
            });
        }).on('error', reject);
    });
}

async function test() {
    console.log("Testing Twitch...");
    try {
        const twitch = await fetchAllOrigins('https://decapi.me/twitch/avatar/jvras_');
        console.log("Twitch:", twitch);
    } catch(e) { console.error("Twitch failed", e); }

    console.log("\nTesting Steam...");
    try {
        const steam = await fetchAllOrigins('https://steamcommunity.com/id/jvras2k/?xml=1');
        const match = steam.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/);
        console.log("Steam:", match ? match[1] : "Not found in XML");
    } catch(e) { console.error("Steam failed", e); }

    console.log("\nTesting TikTok...");
    try {
        const tiktok = await fetchAllOrigins('https://www.tiktok.com/@jvras.fx');
        const match = tiktok.match(/<meta property="og:image" content="([^"]+)"/);
        console.log("TikTok:", match ? match[1] : "Not found");
    } catch(e) { console.error("TikTok failed", e); }
    
    console.log("\nTesting Kick...");
    try {
        const kick = await fetchAllOrigins('https://kick.com/api/v1/channels/jvras');
        const json = JSON.parse(kick);
        console.log("Kick:", json.user?.profile_pic);
    } catch(e) { console.error("Kick failed"); }

    console.log("\nTesting Instagram...");
    try {
        const ig = await fetchAllOrigins('https://www.instagram.com/jvrass/');
        const match = ig.match(/<meta property="og:image" content="([^"]+)"/);
        console.log("IG:", match ? match[1] : "Not found");
    } catch(e) { console.error("IG failed"); }
}
test();
