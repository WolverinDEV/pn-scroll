import {AppSettings, Setting} from "../../Settings";
import {Platform} from "react-native";
import {Logger} from "loglevel";
import {getLogger} from "../../Log";
import { v4 as guuid } from "uuid";
import {PostImage} from "../index";
import ImageLoadResult = PostImage.ImageLoadResult;
import {ImplHttpRequestParameters, ImplHttpResponse} from "../request";

export let worker: RequestProxyHost;
export async function executeLocalProxyRequest(request: ImplHttpRequestParameters) : Promise<ImplHttpResponse> {
    if(!worker) {
        return { status: "failure-internal", message: "worker not initialized" };
    }

    return await worker.proxyRequest(request);
}

export async function setupLocalProxyClient() {
    if(Platform.OS !== "web") {
        /* We don't initialize it */
        return;
    }

    worker = new RequestProxyHost(navigator.serviceWorker);
    await worker.initialize();
}

type RequestWorkerResult = {
    status: "success",
    result: any,
} | {
    status: "failure",
    message: string
};

type PendingWorkerRequest = {
    timeout: any,
    callback: (result: RequestWorkerResult) => void
};

class RequestProxyHost {
    private readonly logger: Logger;
    private readonly requests: { [key: string]: PendingWorkerRequest };
    private readonly addressChangeListener: () => void;
    private readonly worker: ServiceWorkerContainer;

    constructor(worker: ServiceWorkerContainer) {
        this.worker = worker;

        this.logger = getLogger("request-proxy-host");
        this.requests = {};

        this.addressChangeListener = AppSettings.registerChangeCallback(Setting.WebProxyServerAddress, () => {
            this.setupConnectionParameters().then(undefined);
        });
    }

    destroy() {
        this.addressChangeListener();
    }

    async initialize() {
        this.spawnWorker();

        const initializeError = await this.executeThrow("initialize", {});
        if(initializeError) {
            throw new Error("initialize failed: " + initializeError);
        }

        await this.setupConnectionParameters();
    }

    async proxyRequest(request: ImplHttpRequestParameters) : Promise<ImplHttpResponse> {
        /* TODO: Actually transfer the request and response buffers to avoid unnecessary copies */
        const result = await this.execute("proxy-request", request);
        if(result.status !== "success") {
            return { status: "failure-internal", message: result.message };
        }

        return result.result;
    }

    async downloadImage(url: string, headers: { [key: string]: string }): Promise<ImageLoadResult> {
        /*
         * Images will be proxied via the service worker.
         * We only register the custom headers.
         */

        const result = await this.execute("register-image", { url, headers });
        if(result.status !== "success") {
            return { status: "failure", message: result.message };
        }

        return {
            status: "success",
            imageUri: url,
            unload: () => {}
        };
    }

    private async setupConnectionParameters() {
        const result = await this.execute("connection-setup", { url: AppSettings.getValue(Setting.WebProxyServerAddress) });
        if(result.status === "failure") {
            this.logger.warn("Failed to setup server connection: %s", result.message);
        } else {
            this.logger.debug("Connection parameter successfully updated/initialized.");
        }
    }

    private spawnWorker() {
        this.worker.addEventListener("message", ((event: MessageEvent) => {
            if(typeof event.data !== "object") {
                return;
            }

            const { scope } = event.data;
            if(scope !== "web-proxy") {
                /* message is not for us */
                return;
            }

            this.handleWorkerMessage(event.data);
        }) as any);

        this.worker.addEventListener("error", event => {
            /* Worker error. Terminate all requests */
        });
    }

    private handleWorkerError(error: ErrorEvent) {
        this.logger.error("Worker encountered error: %o", error);
    }

    private handleWorkerMessage(message: any) {
        const { type } = message;
        if(type === "response") {
            const { token, status } = message;
            const request = this.requests[token];
            if(!request) {
                this.logger.warn("Received request response for unknown request %s.", token);
                return;
            }

            if(status === "success") {
                request.callback({ status: "success", result: message.payload });
            } else {
                request.callback({ status: "failure", message: message.message || "unknown error" });
            }
        } else {
            this.logger.warn("Received invalid message type %s.", type);
        }
    }

    private async execute(request: string, payload: any,) : Promise<RequestWorkerResult> {
        const token = guuid();
        this.worker?.controller!.postMessage({ scope: "web-proxy", type: "request", request, payload, token });

        const result = await new Promise<RequestWorkerResult>(resolve => {
            this.requests[token] = {
                callback: resolve,
                timeout: setTimeout(() => resolve({ status: "failure", message: "timeout" }), 15_000)
            };
        });

        clearTimeout(this.requests[token].timeout);
        delete this.requests[token];
        return result;
    }

    private async executeThrow(request: string, payload: any) : Promise<any> {
        const response = await this.execute(request, payload);
        if(response.status !== "success") {
            throw new Error(response.message);
        }

        return response.result;
    }
}
