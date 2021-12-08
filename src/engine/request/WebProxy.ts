import {ImplHttpRequestParameters, ImplHttpResponse} from "./index";
import {AppSettings, Setting} from "../../Settings";
import {Platform} from "react-native";
import {Logger} from "loglevel";
import {getLogger} from "../../Log";
import { v4 as guuid } from "uuid";
import {PostImage} from "../index";
import ImageLoadResult = PostImage.ImageLoadResult;

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

    worker = new RequestProxyHost();
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

    private worker: Worker | null;

    constructor() {
        this.logger = getLogger("request-proxy-host");
        this.worker = null;
        this.requests = {};

        this.addressChangeListener = AppSettings.registerChangeCallback(Setting.WebProxyServerAddress, () => {
            this.setupConnectionParameters().then(undefined);
        });
    }

    destroy() {
        if(this.worker) {
            /* TODO: Proper terminate after sending destroy message? */
            this.worker.terminate();
            this.worker = null;
        }
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
        const result = await this.execute("download-image", { url, headers });
        if(result.status !== "success") {
            return { status: "failure", message: result.message };
        }

        const loadResult = result.result as ImageLoadResult;
        if(loadResult.status === "success") {
            loadResult.unload = () => {};
        }
        return loadResult;
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
        const worker = this.worker = new Worker(new URL('proxy-worker/Worker', import.meta.url));
        this.worker.onerror = error => {
            if(worker != this.worker) {
                return;
            }

            this.handleWorkerError(error);
        }

        this.worker.onmessage = event => {
            if(worker != this.worker) {
                return;
            }

            this.handleWorkerMessage(event.data);
        }
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
        this.worker?.postMessage({ type: "request", request, payload, token });

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
