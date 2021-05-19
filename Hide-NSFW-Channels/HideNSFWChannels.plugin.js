/**
 * @name HideNSFWChannels
 * @author Farcrada
 * @version 1.0.0
 * @description Hide NSFW channels.
 * 
 * @website https://github.com/Farcrada/DiscordPlugins
 * @source https://github.com/Farcrada/DiscordPlugins/blob/master/Hide-NSFW-Channels/HideNSFWChannels.plugin.js
 * @updateUrl https://raw.githubusercontent.com/Farcrada/DiscordPlugins/master/Hide-NSFW-Channels/HideNSFWChannels.plugin.js
 */


class HideNSFWChannels {
    getName() { return "Hide NSFW channels"; }
    getDescription() { return "Hide NSFW channels."; }
    getVersion() { return "1.0.0"; }
    getAuthor() { return "Farcrada"; }

    start() { }

    stop() { }

    //For ease, just make use of the tools we have which also stops as soon as the plugin is stopped.
    observer(changes) {
        //Check if a node is being added, that's where our focus lies.
        if (changes.addedNodes.length < 1)
            return;

        //Since it's a NodeList, lets array this bitch.
        //But since you can't break in a .forEach(), we opt for .every()
        Array.from(changes.addedNodes).every(node => {
            //Sometimes it's not a node, so we have to prevent errors there.
            if (node.nodeType !== Node.ELEMENT_NODE)
                //Basically means "continue" in .forEach() language
                return true;

            //Sometimes it enters something that has no name
            if (!node.classList.contains(BdApi.findModuleByProps("containerDefault").containerDefault))
                return true;

            //Check the internals and look for the Channel property which contains the channel's ID.
            let instance = node[Object.keys(node).find(key => key.startsWith("__reactInternal"))];
            let instanceChannel = instance && findValue(instance, "channel");

            if (!instanceChannel)
                return true;

            //if the channel is indeed NSFW flagged, hide it.
            if (instanceChannel.nsfw)
                node.style.display = "none";
        })
    }
}

function findValue(instance, searchkey) {
    //Where to search
    var whitelist = {
        memoizedProps: true,
        child: true
    };
    //Where not to search
    var blacklist = {
        contextSection: true
    };

    return getKey(instance);

    function getKey(instance) {
        //In case the result is never filled, predefine it.
        var result = undefined;
        //Check if it exists
        if (instance && !Node.prototype.isPrototypeOf(instance)) {
            //Filter inherited properties
            let keys = Object.getOwnPropertyNames(instance);
            //As long as result is undefined and within keys.length; loop
            for (let i = 0; result === undefined && i < keys.length; i++) {
                let key = keys[i];

                //Make sure the property's not blacklisted
                if (key && !blacklist[key]) {
                    var value = instance[key];

                    //if this is the key we're looking for, return it
                    if (searchkey === key)
                        return value;

                    //If it's an object or function and it is white
                    else if ((typeof value === "object" || typeof value === "function") &&
                        (whitelist[key] || key[0] == "." || !isNaN(key[0])))
                        result = getKey(value);
                }
            }
        }
        return result;
    }
}
