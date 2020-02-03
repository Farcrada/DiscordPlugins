//META{"name":"DoubleClickToEditPTB","displayName":"DoubleClickToEditPTB","website":"https://github.com/Farcrada/Double-click-to-edit","source":"https://github.com/Farcrada/Double-click-to-edit/blob/master/DoubleClickToEditPTB.plugin.js"}*//

class DoubleClickToEditPTB {
    getName() { return "Double click to edit PTB"; }
    getDescription() { return "Double click messages to edit them. (PTB version)"; }
    getVersion() { return "8.0"; }
    getAuthor() { return "Farcrada, original by Jiiks"; }

    start() {
        let libraryScript = document.getElementById("ZLibraryScript");
        if (!libraryScript || !window.ZLibrary) {
            if (libraryScript) libraryScript.parentElement.removeChild(libraryScript);
            libraryScript = document.createElement("script");
            libraryScript.setAttribute("type", "text/javascript");
            libraryScript.setAttribute("src", "https://rauenzi.github.io/BDPluginLibrary/release/ZLibrary.js");
            libraryScript.setAttribute("id", "ZLibraryScript");
            document.head.appendChild(libraryScript);
        }

        if (window.ZLibrary) this.initialize();
        
        try {
            document.addEventListener('dblclick', this.handler);
        }
        catch(err) {
            console.error(this.getName(), "fatal error, plugin could not be started!", err);
            
            try {
                this.stop();
            }
            catch(err) {
                console.error(this.getName() + ".stop()", err);
            }
        }
    }

    initialize() {
        ZLibrary.PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), "https://raw.githubusercontent.com/Farcrada/Double-click-to-edit/master/DoubleClickToEditPTB.plugin.js");
    }

    stop() {
        document.removeEventListener('dblclick', this.handler);
    }
    
    handler(e) {
        const message = e.target.closest('[class^=message]');
        if (!message)
            return;
        
        const btn = message.querySelector('[class^=buttonContainer] [class^=button-][aria-label=More]');
        if (!btn)
            return;
        btn.click();

        const popup = document.querySelector('[class^=contextMenu]');
        if (!popup)
            return;

        const rii = popup[Object.keys(popup).find(k => k.startsWith('__reactInternal'))];
        if (!rii || !rii.memoizedProps || !rii.memoizedProps.children[0]
            || !rii.memoizedProps.children[0].props || !rii.memoizedProps.children[0].props.children[0]
            || !rii.memoizedProps.children[0].props.children[0].props
            || !rii.memoizedProps.children[0].props.children[0].props.action)
        {
            btn.click();
            return;
        }
        rii.memoizedProps.children[0].props.children[0].props.action();
        return;
    }
}
