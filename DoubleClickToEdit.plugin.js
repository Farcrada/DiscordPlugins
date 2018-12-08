//META{"name":"DoubleClickToEdit"}*,"displayName":"DoubleClickToEdit","website":"https://github.com/Farcrada/dblClickEdit.plugin.js","source":"https://github.com/Farcrada/blob/master/dblClickEdit.plugin.js"}*//

class DoubleClickToEdit {
    getName() { return "Double click to edit"; }
    getDescription() { return "Double click messages to edit them."; }
    getVersion() { return "0.3.0"; }
    getAuthor() { return "Original by Jiiks, conversion by Farcrada"; }

    start() {
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

    stop() {
        document.removeEventListener('dblclick', this.handler);
    }
    
    handler(e) {
        const message = e.target.closest('[class^=messageCozy]') || e.target.closest('[class^=messageCompact]');
        if (!message)
            return;
        
        const btn = message.querySelector('[class^=buttonContainer] [class^=button-]');
        if (!btn)
            return;

        btn.click();

        const popup = document.querySelector('[class^=container][role=menu]');
        if (!popup)
            return;

        const rii = popup[Object.keys(popup).find(k => k.startsWith('__reactInternal'))];
        if (!rii || !rii.memoizedProps || !rii.memoizedProps.children || !rii.memoizedProps.children[1] || !rii.memoizedProps.children[1].props || !rii.memoizedProps.children[1].props.onClick)
            return;

        rii.memoizedProps.children[1].props.onClick();
    }
}
