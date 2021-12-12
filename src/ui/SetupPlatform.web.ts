import iconFont from 'react-native-vector-icons/Fonts/FontAwesome.ttf';
import {registerServiceWorker} from "../engine/web/ServiceWorker";
import {setupLocalProxyClient} from "../engine/web/WebProxy";
function setupCustomCss() {
    const cssLines = [];
    cssLines.push(
        `@font-face {`,
        `  src: url(${iconFont});`,
        `  font-family: FontAwesome;`,
        `}`
    );

    cssLines.push(
        `* {`,
        `  user-select: none;`,
        `  color: red;`,
        `}`
    );

    cssLines.push(
        `*:focus {`,
        `  outline: none;`,
        `}`
    );

    const style = document.createElement('style');
    style.appendChild(document.createTextNode(
        cssLines.join("\n")
    ));

    document.head.appendChild(style);
}

export async function setupPlatformFunctions() {
    console.info("Web setup!");

    setupCustomCss();
    await registerServiceWorker();
    await setupLocalProxyClient();
}

export { BrowserRouter as PlatformRouter } from "react-router-dom";
