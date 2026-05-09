const fs = require('fs');
const appJs = fs.readFileSync('app.js', 'utf8');
const match = appJs.match(/const YOUTUBE_API_KEY\s*=\s*['"]([^'"]+)['"]/);
const key = match[1];

async function test() {
    const r1 = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=UCGHa0lO39Xsgj-nu8sWqD2A&key=${key}`);
    const d1 = await r1.json();
    const uploadsId = d1.items[0].contentDetails.relatedPlaylists.uploads;

    const r2 = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=50&key=${key}`);
    const d2 = await r2.json();
    
    const ids = d2.items.map(i => i.snippet.resourceId.videoId).join(',');
    const r3 = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${ids}&key=${key}`);
    const d3 = await r3.json();

    const longVideos = d2.items.filter(item => {
        const vidDetails = d3.items.find(v => v.id === item.snippet.resourceId.videoId);
        if (!vidDetails) return true;
        const durationStr = vidDetails.contentDetails.duration;
        const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        if (!match) return true;
        const h = parseInt(match[1] || 0);
        const m = parseInt(match[2] || 0);
        const s = parseInt(match[3] || 0);
        const totalSeconds = h * 3600 + m * 60 + s;
        return totalSeconds > 65;
    });

    console.log(`Total fetched: ${d2.items.length}`);
    console.log(`Long videos found: ${longVideos.length}`);
    for(let i=0; i<Math.min(5, longVideos.length); i++) {
        console.log(longVideos[i].snippet.title);
    }
}
test();
