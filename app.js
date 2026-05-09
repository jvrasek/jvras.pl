const YOUTUBE_API_KEY = "AIzaSyCY0qjQ9JrGIvKKLD3b3jpwhkC1jHORVuQ"; 
const DISCORD_SERVER_ID = "1217703760596566117";

const youtubeHandles = {
    'stat-jvras': { type: 'handle', val: 'jvrasek' },
    'stat-jvras-plus': { type: 'handle', val: 'jvrasplus' },
    'stat-jvras-cs2': { type: 'handle', val: 'jvrascs2' },
    'stat-jvras-fx': { type: 'handle', val: 'jvras-fx' }
};

// --- Formatter dla liczb ---
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1).replace('.0', '') + ' mln';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1).replace('.0', '') + ' tys.';
    }
    return num.toString();
}

// --- Animate Counter ---
function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = formatNumber(Math.floor(progress * (end - start) + start));
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

// --- Pobieranie danych z YouTube (Zbiorcze Statystyki + Kafelki) ---
async function fetchYouTubeStats() {
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY.trim() === "") return;

    let totalSubs = 0;
    let totalViews = 0;

    for (const [elementId, channelData] of Object.entries(youtubeHandles)) {
        try {
            const el = document.getElementById(elementId);
            const avatarEl = document.getElementById(elementId.replace('stat-', 'avatar-'));
            
            let url = "";
            if (channelData.type === 'id') {
                url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelData.val}&key=${YOUTUBE_API_KEY}`;
            } else {
                url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&forHandle=@${channelData.val}&key=${YOUTUBE_API_KEY}`;
            }

            const response = await fetch(url);
            const data = await response.json();

            if (data.items && data.items.length > 0) {
                const channel = data.items[0];
                const stats = channel.statistics;
                const subs = parseInt(stats.subscriberCount);
                
                if (el) el.innerHTML = formatNumber(subs) + ' subskrypcji';
                if (avatarEl) {
                    const avatarUrl = channel.snippet.thumbnails.high ? channel.snippet.thumbnails.high.url : channel.snippet.thumbnails.default.url;
                    avatarEl.src = avatarUrl;
                    avatarEl.style.display = 'block';
                }
                
                totalSubs += subs;
                totalViews += parseInt(stats.viewCount);
                
                // Główny avatar z głównego kanału
                if (elementId === 'stat-jvras') {
                    const mainAvatar = document.getElementById('main-avatar');
                    if (mainAvatar) mainAvatar.src = channel.snippet.thumbnails.high.url;
                }
            }
        } catch (error) {
            console.error(`Błąd YouTube dla ${elementId}:`, error);
        }
    }

    const subsEl = document.getElementById('total-subs');
    const viewsEl = document.getElementById('total-views');
    if (subsEl) animateValue(subsEl, 0, totalSubs, 2000);
    if (viewsEl) animateValue(viewsEl, 0, totalViews, 2500);
}

// --- Pobieranie prawdziwych avatarów z innych platform ---
async function fetchRealAvatars() {
    function setAvatar(selector, url) {
        if(url && url.startsWith('http')) {
            document.querySelectorAll(selector).forEach(img => {
                img.src = url;
                img.style.display = "block";
            });
        }
    }

    // Twitch
    try {
        const res = await fetch('https://decapi.me/twitch/avatar/jvras_');
        const url = await res.text();
        if (url && url.startsWith('http')) setAvatar('.twitch .real-avatar', url);
    } catch(e) { console.error('Twitch avatar fetch error:', e); }

    try {
        const res = await fetch('https://decapi.me/twitch/followcount/jvras_');
        const count = await res.text();
        const statEl = document.querySelector('.twitch .stats');
        if(statEl && !isNaN(parseInt(count))) statEl.innerHTML = formatNumber(parseInt(count)) + ' obserwujących';
    } catch(e) { console.error('Twitch follow fetch error:', e); }

    // Steam
    try {
        const res = await fetch('https://playerdb.co/api/player/steam/jvras2k');
        const data = await res.json();
        if (data.data && data.data.player && data.data.player.avatar) {
            setAvatar('.steam .real-avatar', data.data.player.avatar);
        }
    } catch(e) { console.error('Steam avatar fetch error:', e); }

    // TikTok (indywidualnie dla każdego profilu)
    const tiktokAccounts = ['jvras.fx', 'jvrasek', 'jvras.cs2'];
    for (const acc of tiktokAccounts) {
        try {
            const res = await fetch(`https://www.tikwm.com/api/user/info?unique_id=${acc}`);
            const data = await res.json();
            if (data.data) {
                document.querySelectorAll('.mini-card').forEach(card => {
                    if (card.href.includes(acc)) {
                        if (data.data.user && data.data.user.avatarThumb) {
                            const img = card.querySelector('img');
                            if (img) img.src = data.data.user.avatarThumb;
                        }
                        if (data.data.stats && data.data.stats.followerCount !== undefined) {
                            const statEl = card.querySelector('.stats');
                            if (statEl) statEl.innerHTML = formatNumber(data.data.stats.followerCount) + ' obserwujących';
                        }
                    }
                });
            }
        } catch(e) { console.error(`TikTok fetch error for ${acc}:`, e); }
    }
}

// --- Pobieranie Widgetu Discord ---
async function fetchDiscordWidget() {
    const listEl = document.getElementById('discord-users-list');
    const countEl = document.getElementById('discord-online-count');

    try {
        const response = await fetch(`https://discord.com/api/guilds/${DISCORD_SERVER_ID}/widget.json`);
        const data = await response.json();
        
        if (data.presence_count !== undefined) {
            countEl.innerText = `${data.presence_count} ONLINE`;
            
            const members = data.members.slice(0, 20);
            listEl.innerHTML = members.map(m => `
                <div class="user-item">
                    <div class="user-avatar-wrap">
                        <img src="${m.avatar_url}" alt="${m.username}">
                        <div class="user-status" style="background: ${m.status === 'online' ? '#3ba55c' : m.status === 'idle' ? '#faa61a' : '#f04747'}"></div>
                    </div>
                    <span>${m.username}</span>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error("Discord Widget Error:", err);
    }
}

// --- Pobieranie Ostatnich Filmów YouTube ---
async function fetchRecentVideos() {
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY.trim() === "") return;
    
    const videosContainer = document.getElementById('youtube-videos-list');
    if (!videosContainer) return;

    try {
        let longVideos = [];
        let pageToken = '';
        let pagesFetched = 0;
        const uploadsPlaylistId = 'UUGHa0lO39Xsgj-nu8sWqD2A'; // Playlista 'Przesłane' dla kanału jvras

        while (longVideos.length < 4) {
            let url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50&key=${YOUTUBE_API_KEY}`;
            if (pageToken) url += `&pageToken=${pageToken}`;
            
            const playlistRes = await fetch(url);
            const playlistData = await playlistRes.json();
            
            if (!playlistData.items || playlistData.items.length === 0) break;
            
            const videoIds = playlistData.items.map(item => item.snippet.resourceId.videoId).join(',');
            const videosRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`);
            const videosData = await videosRes.json();
            
            const filtered = playlistData.items.filter(item => {
                const videoId = item.snippet.resourceId.videoId;
                const vidDetails = videosData.items ? videosData.items.find(v => v.id === videoId) : null;
                if (!vidDetails) return false;
                
                const durationStr = vidDetails.contentDetails.duration;
                let totalSeconds = 0;
                const hMatch = durationStr.match(/(\d+)H/);
                const mMatch = durationStr.match(/(\d+)M/);
                const sMatch = durationStr.match(/(\d+)S/);
                if (hMatch) totalSeconds += parseInt(hMatch[1]) * 3600;
                if (mMatch) totalSeconds += parseInt(mMatch[1]) * 60;
                if (sMatch) totalSeconds += parseInt(sMatch[1]);
                
                const title = item.snippet.title.toLowerCase();
                const isShortTag = title.includes('#shorts') || title.includes('#short');
                
                // TYLKO filmy powyżej 3 minut (180s) - Shortsy mają max 3 minuty
                return totalSeconds > 180 && !isShortTag;
            });
            
            // Mapujemy, aby zachować strukturę do wyświetlania
            const mapped = filtered.map(item => {
                const videoId = item.snippet.resourceId.videoId;
                const vidDetails = videosData.items.find(v => v.id === videoId);
                return {
                    id: { videoId: videoId },
                    snippet: vidDetails ? vidDetails.snippet : item.snippet
                };
            });

            longVideos = longVideos.concat(mapped);
            pageToken = playlistData.nextPageToken;
            
            if (!pageToken) break;
            if (pagesFetched++ > 10) break; // Zabezpieczenie przed nieskończoną pętlą
        }
        
        longVideos = longVideos.slice(0, 4);
        
        if (longVideos.length > 0) {
            videosContainer.innerHTML = longVideos.map(item => {
                const snippet = item.snippet;
                const videoId = item.id.videoId;
                const thumb = snippet.thumbnails.maxres ? snippet.thumbnails.maxres.url : snippet.thumbnails.high.url;
                
                return `
                    <a href="https://www.youtube.com/watch?v=${videoId}" target="_blank" class="video-item">
                        <div class="video-item-thumb">
                            <img src="${thumb}" alt="${snippet.title}">
                            <div class="play-icon"><i class="fas fa-play"></i></div>
                        </div>
                        <h4 class="video-item-title">${snippet.title}</h4>
                    </a>
                `;
            }).join('');
        } else {
            videosContainer.innerHTML = '<div style="color: white; text-align:center; padding: 20px; font-size: 0.8rem;">Nie znaleziono długich filmów w ostatnich 250 materiałach.</div>';
        }
    } catch (e) {
        console.error("YouTube Videos Fetch Error:", e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Theme Switcher ---
    const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
    const currentTheme = localStorage.getItem('theme');

    if (currentTheme) {
        document.documentElement.setAttribute('data-theme', currentTheme);
        if (currentTheme === 'dark') {
            toggleSwitch.checked = true;
        }
    }

    function switchTheme(e) {
        if (e.target.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    }
    
    if (toggleSwitch) {
        toggleSwitch.addEventListener('change', switchTheme);
    }

    setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) loader.classList.add('hidden');
    }, 1800);

    fetchRealAvatars();
    fetchYouTubeStats();
    fetchDiscordWidget();
    fetchRecentVideos();
});
