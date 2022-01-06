import {getLogger, initializeLogScope} from "../../../Log";
import {serviceWorker} from "./Scope";
initializeLogScope("service-worker");

const logger = getLogger("general");
serviceWorker.addEventListener("activate", () => {
    logger.info("Service worker activated.");
});

serviceWorker.addEventListener("install", event => {
    console.error("Install: %o", event);
    logger.info("Service worker activated.");
});

import "./Messages";
import "./FetchProxy";
