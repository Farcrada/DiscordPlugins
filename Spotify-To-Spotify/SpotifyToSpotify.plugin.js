/**
 * @name Spotify To Spotify
 * @author Farcrada
 * @version 1.0.1
 * @description Redirects Spotify links to Spotify app instead of opening the webpage.
 * 
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Spotify-To-Spotify/SpotifyToSpotify.plugin.js
 */

const { shell } = require('electron');

module.exports = class SpotifyToSpotify {
    start() {
        document.addEventListener("click", this.redirectToSpotify);
    }
    stop() {
        document.removeEventListener("click", this.redirectToSpotify);
    }
    
	redirectToSpotify(e) {
		let linkElement = e?.target?.closest?.('a');

		if (linkElement?.href?.includes?.("open.spotify.com")) {
            e.preventDefault();

			let url = linkElement.href.split("/");
            shell.openExternal(`spotify://${url[3]}/${url[url.length - 1]}`);
        };
    }
}
