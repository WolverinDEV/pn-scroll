import {getLogger, initializeLogScope} from "../../../Log";
import "./Messages";
import {imageCache} from "./Images";
import {requestClient} from "./Messages";

initializeLogScope("service-worker");
const logger = getLogger("general");

type RegisteredImage = {
    url: string,
    headers: { [key: string]: string },
};
export const registeredImages: { [key: string]: RegisteredImage } = {};

const sw = (self as any) as ServiceWorkerGlobalScope;
sw.addEventListener("activate", (event: ExtendableEvent) => {
    logger.info("Service worker activated.");
});

sw.addEventListener("fetch", event => {
    if(event.request.url in registeredImages) {
        const image = registeredImages[event.request.url];
        logger.debug("Proxy request %s with %o.", event.request.url, image);
        event.respondWith((async () => {
            const result = await imageCache.resolve({ url: image.url, headers: image.headers, proxyClient: requestClient });
            switch (result.status) {
                case "missing":
                    return new Response("Missing image cache entry. This should never happen!", { status: 500 });

                case "error":
                    return new Response(result.message, { status: 500 });

                case "resolved":
                    if(result.value.status === "failure") {
                        return new Response(result.value.message, { status: 500 });
                    } else {
                        return new Response(result.value.data, {
                            headers: result.value.headers,
                            status: 200
                        });
                    }

                default:
                    return new Response("this should never happen!", { status: 500 });
            }
        })());
    } else if(/* if not same origin/proxy eligible target */false) {
        /* TODO: Lookup the local cache if we might already have a response. */
    }

    // readonly clientId: string;
    // readonly handled: Promise<undefined>;
    // readonly request: Request;
    // readonly resultingClientId: string;
    // respondWith(r: Response | PromiseLike<Response>): void;
});
