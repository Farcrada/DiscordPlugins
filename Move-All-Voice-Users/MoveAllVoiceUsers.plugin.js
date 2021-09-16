/**
 * @name MoveAllVoiceUsers
 * @author Farcrada
 * @version 0.9.4
 * 
 * @website https://github.com/Farcrada/DangerousDiscordPlugins
 */


const config = {
    info: {
        name: "Move All Voice Users",
        version: "0.9.4",
        author: "Farcrada",
        website: "https://github.com/Farcrada/DangerousDiscordPlugins"
    }
}


class MoveAllVoiceUsers {
    start() {
        BdApi.showConfirmationModal(`Plugin ${config.info.name} removed`,
            `The plugin ${config.info.name} has been removed. It directly speaks to the API and can thus be dangerous.

Abuse has a certain guarantee to get the user banned. If you would like to read more press "Visit".`, {
            confirmText: "Visit",
            cancelText: "Cancel",
            onConfirm: () => {
                return require("electron").shell.openExternal(config.info.website);
            }
        });
    }

    stop() {}
}
