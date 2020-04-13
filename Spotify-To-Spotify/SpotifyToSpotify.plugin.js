/**
 * @name SpotifyToSpotify
 * 
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Spotify-To-Spotify/SpotifyToSpotify.plugin.js
 */

const { shell } = require('electron');

class SpotifyToSpotify {
    getName() { return "Spotify to Spotify"; }
    getDescription() { return "Redirects Spotify links to Spotify app instead of opening the webpage."; }
    getVersion() { return "1"; }
    getAuthor() { return "Farcrada"; }

    start() {
        document.addEventListener("click", this.redirectToSpotify);
    }
    stop() {
        document.removeEventListener("click", this.redirectToSpotify);
    }

    unload() {
        this.stop();
    }
    
    redirectToSpotify(e) {
        if (e.target.localName == "a" && e.target.href.includes("open.spotify.com")) {
            e.preventDefault();
            
            let url = e.target.href.split("/");
            shell.openExternal(`spotify://${url[3]}/${url[url.length - 1]}`);
        };
    }
}

