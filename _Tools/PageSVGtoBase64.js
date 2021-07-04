//This gets all the svgs in the current page and converts them to Base64.
(function (w, d) {
    'use strict';
    let documentSVG = d.getElementsByTagName('svg');
    for (let i = 0; i < documentSVG.length; i++) {
        let svg = new XMLSerializer().serializeToString(documentSVG[i]);
        let base64 = w.btoa(svg);
        let img = d.createElement('img');
        img.src = "data:image/svg+xml;base64," + base64;
        d.body.appendChild(img);
    }
}(window, document));
