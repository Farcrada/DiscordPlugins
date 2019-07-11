//META{"name":"DoubleClickToEdit","displayName":"DoubleClickToEdit","website":"https://github.com/Farcrada/Double-click-to-edit","source":"https://github.com/Farcrada/Double-click-to-edit/blob/master/DoubleClickToEdit.plugin.js"}*//

class DoubleClickToEdit {
    getName() { return "Double click to edit"; }
    getDescription() { return "Double click messages to edit them."; }
    getVersion() { return "0.4.3"; }
    getAuthor() { return "Farcrada, original by Jiiks"; }

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

        if (!rii || !rii.memoizedProps || !rii.memoizedProps.children)
        {
            btn.click();
            return;
        }

        for (var i = 0; i < rii.memoizedProps.children.length; i++)
        {
            if (!rii.memoizedProps.children[i])
                continue;
            if (!rii.memoizedProps.children[i].props)
                continue;
            if (!rii.memoizedProps.children[i].props.children)
                continue;
            if (!rii.memoizedProps.children[i].props.children.startsWith)
                continue;
            if (!rii.memoizedProps.children[i].props.children.startsWith('Edit'))
                continue;
            
            rii.memoizedProps.children[i].props.onClick();
            return;
        }

        btn.click();
    }
}
