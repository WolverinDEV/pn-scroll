import {getLogger} from "../../Log";
import {extractErrorMessage} from "../../utils";

const logger = getLogger("service-worker");
export async function registerServiceWorker() {
    /*
     * The service worker is required to proxy all requests to the external sites.
     */
    if(!('navigator' in self) || !('serviceWorker' in navigator)) {
        throw "service worker not supported";
    }

    let registeredWorker: ServiceWorkerRegistration;
    try {
        /* TODO: Changing the service worker URL is bad practice: https://developers.google.com/web/fundamentals/primers/service-workers/lifecycle#avoid-url-change */
        registeredWorker = await navigator.serviceWorker.register(new URL('service-worker/Worker', import.meta.url));
        await registeredWorker.update();
    } catch (error) {
        logger.error("Failed to register service worker: %s", extractErrorMessage(error));
        throw "failed to register service worker";
    }

    if(!registeredWorker.active) {
        /* FIXME: Wait 'till active! */
        throw "registered service worker is not active";
    }

    registeredWorker.active.postMessage({ type: "hello" });
    navigator.serviceWorker.onmessage = event => {
        logger.info("Received message: %o", event.data);
    }

    logger.info("Service worker registered.");
}
