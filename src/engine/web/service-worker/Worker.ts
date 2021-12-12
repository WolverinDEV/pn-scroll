import {getLogger, initializeLogScope} from "../../../Log";
import {serviceWorker} from "./Scope";
initializeLogScope("service-worker");

const logger = getLogger("general");
serviceWorker.addEventListener("activate", (event: ExtendableEvent) => {
    logger.info("Service worker activated.");
});

import "./Messages";
import "./FetchProxy";
