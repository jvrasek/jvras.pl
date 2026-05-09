const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');
const keyMatch = appJs.match(/const YOUTUBE_API_KEY\s*=\s*['"]([^'"]+)['"]/);
if (!keyMatch) { console.log('Key not found'); process.exit(1); }
const key = keyMatch[1];

async function check() {
    try {
        const chanRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=UCGHa0lO39Xsgj-nu8sWqD2A&key=${key}`);
        const chanData = await chanRes.json();
        const uploadsId = chanData.items[0].contentDetails.relatedPlaylists.uploads;

        const playlistRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=20&key=${key}`);
        const playlistData = await playlistRes.json();
        
        const ids = playlistData.items.map(i => i.snippet.resourceId.videoId).join(',');
        const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${ids}&key=${key}`);
        const vData = await vRes.json();

        console.log('--- OSTATNIE 20 FILMÓW ---');
        vData.items.forEach(v => {
            console.log(`[${v.contentDetails.duration}] ${v.snippet.title}`);
        });
    } catch (e) {
        console.log('ERROR:', e.message);
    }
}
check();
