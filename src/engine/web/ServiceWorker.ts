import {getLogger} from "../../Log";
import {extractErrorMessage} from "../../utils";

type WorkerState = "installing" | "active";

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

    await new Promise<void>(resolve => {
        if(registeredWorker.installing) {
            registeredWorker.installing.addEventListener("statechange", () => resolve());
        } else {
            resolve();
        }
    });

    if(!registeredWorker.active) {
        /* This should never happen! */
        throw "registered service worker is not active";
    }

    registeredWorker.active.postMessage({ type: "hello" });
    logger.info("Service worker registered.");
}
