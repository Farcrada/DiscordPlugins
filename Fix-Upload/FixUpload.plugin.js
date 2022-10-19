/**
 * @name Fix Upload
 * @author Farcrada
 * @version 1.0.1
 * @description Fix upload-button back to a single click operation.
 * 
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Fix-Upload/FixUpload.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Fix-Upload/FixUpload.plugin.js
 */


const { Webpack, Webpack: { Filters }, Patcher } = BdApi,

	config = {
		info: {
			name: "Fix Upload",
			id: "FixUpload",
			description: "Fix upload-button back to a single click operation.",
			version: "1.0.1",
			author: "Farcrada",
			updateUrl: "https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Fix-Upload/FixUpload.plugin.js"
		}
	};


module.exports = class FixUpload {


	start() {
		//First try the updater
		try {
			global.ZeresPluginLibrary.PluginUpdater.checkForUpdate(config.info.name, config.info.version, config.info.updateUrl);
		}
		catch (err) {
			console.error(config.info.name, "Plugin Updater could not be reached.", err);
		}

		//Now try to initialize.
		try {
			const desiredFilter = m => m?.BorderColors && m?.Link,
				theModule = Webpack.getModule(m => Object.values(m).some(desiredFilter), { searchExports: false }),
				matchedKey = Object.keys(theModule).find(k => desiredFilter(theModule[k]));

			Patcher.before(config.info.id, theModule, matchedKey, (thisObject, methodArguments, returnValue) => {
				if (methodArguments[0]?.onClick && methodArguments[0]?.onDoubleClick) {
					//Transfer the double click action to the single click action.
					methodArguments[0].onClick = methodArguments[0].onDoubleClick;
					//Null this to prevent triple opening the upload window.
					methodArguments[0].onDoubleClick = () => {};
				}
			});
		}
		catch (err) {
			try {
				console.error("Attempting to stop after initialization error...", err)
				this.stop();
			}
			catch (err) {
				console.error(config.info.name + ".stop()", err);
			}
		}
	}

	stop() { Patcher.unpatchAll(config.info.id); }
}
