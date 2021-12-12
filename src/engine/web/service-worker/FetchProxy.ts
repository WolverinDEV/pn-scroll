import {imageCache} from "./Images";
import {messageHandler, requestClient} from "./Messages";
import {objectHeadersToKv} from "../../blog-provider/Helper";
import {serviceWorker} from "./Scope";

type RegisteredRequest = {
    url: string,
    headers: { [key: string]: string },
    mode: "image" | "fetch"
};

const kResponseMissingRequestWorker = new Response("Missing request worker", { status: 500 });
class FetchProxy {
    private readonly registeredRequests: { [key: string]: RegisteredRequest } = {};
    private readonly listenerFetchEvent: any;

    constructor() {
        this.listenerFetchEvent = (event: FetchEvent) => this.handleFetchEvent(event);
    }

    initialize() {
        serviceWorker.addEventListener("fetch", this.listenerFetchEvent);
    }

    destroy() {
        serviceWorker.removeEventListener("fetch", this.listenerFetchEvent);
    }

    registerRequest(mode: "image" | "fetch", url: string, headers: { [key: string]: string }) {
        this.registeredRequests[url] = {
            mode,
            url,
            headers,
        };
    }

    private handleFetchEvent(event: FetchEvent) {
        if(!(event.request.url in this.registeredRequests)) {
            /* We don't proxy the request. */
            return;
        }

        const requestInfo = this.registeredRequests[event.request.url];
        if(requestInfo.mode !== "image") {
            /* We keep the image info since the browser may load the images more than one time since we only display them on demand. */
            delete this.registeredRequests[event.request.url];
        }

        event.respondWith(FetchProxy.processProxyRequest(event.request, requestInfo));
    }

    private static async processProxyRequest(request: Request, proxyInfo: RegisteredRequest): Promise<Response> {
        if(proxyInfo.mode === "image") {
            const result = await imageCache.resolve({ url: proxyInfo.url, headers: proxyInfo.headers, proxyClient: requestClient });
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
        } else {
            if(!requestClient) {
                return kResponseMissingRequestWorker;
            }

            /* Just simple proxy */
            /* FIXME: Transform the body! */
            const response = await requestClient.execute({
                body: undefined,
                url: request.url,
                method: request.method as any,
                headers: objectHeadersToKv(request.headers)
            });

            switch (response.status) {
                case "failure-internal":
                    return new Response(response.message, { status: 500 });

                case "failure":
                case "success":
                    return new Response(response.payload, {
                        headers: response.headers,
                        status: response.statusCode,
                        statusText: response.statusText
                    });
            }
        }
    }
}

const fetchProxy = new FetchProxy();
fetchProxy.initialize();

messageHandler.registerHandler("register-request", async ({ url, headers }) => {
    fetchProxy.registerRequest("fetch", url, headers);
});

messageHandler.registerHandler("register-image", async ({ url, headers }) => {
    fetchProxy.registerRequest("image", url, headers);
});
