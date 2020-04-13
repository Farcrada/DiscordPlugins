/**
 * @name SteamToSteam
 * 
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Steam-To-Steam/SteamToSteam.plugin.js
 */

const { shell } = require('electron');

class SteamToSteam {
    getName() { return "Steam to Steam"; }
    getDescription() { return "Redirects Steam links to the Steam app instead of opening the webpage."; }
    getVersion() { return "1"; }
    getAuthor() { return "Farcrada"; }

    start() {
        document.addEventListener("click", this.redirectToSteam);
    }
    stop() {
        document.removeEventListener("click", this.redirectToSteam);
    }

    redirectToSteam(e) {
        if (e.target.localName == "a" &&
            (
                e.target.href.includes("steamcommunity.") ||
                e.target.href.includes("store.steampowered.")
            )) {
            e.preventDefault();
            shell.openExternal(`steam://openurl/${e.target.href}`);
        }
    }
}
