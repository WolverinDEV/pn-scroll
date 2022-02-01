import { AppSettings, Setting } from "../../Settings";
import { Platform } from "react-native";
import { Logger } from "loglevel";
import { getLogger } from "../../Log";
import { v4 as guuid } from "uuid";
import { ImplHttpRequestParameters, ImplHttpResponse } from "../request";
import { objectHeadersToKv } from "../blog-provider/Helper";
import { extractErrorMessage } from "../../utils";

export let worker: RequestProxyHost;

export async function executeFetchRequest(request: ImplHttpRequestParameters): Promise<ImplHttpResponse> {
    if (!worker) {
        return { status: "failure-internal", message: "worker not initialized" };
    }

    await worker.registerRequest(request);

    let body: ReadableStream<Uint8Array> | null = null;
    const bodyBuffer = request.body;
    if (bodyBuffer && bodyBuffer.byteLength > 0) {
        let consumed = false;
        body = new ReadableStream<Uint8Array>({
            pull(controller) {
                if (consumed || !request.body) {
                    controller.close();
                } else {
                    controller.enqueue(new Uint8Array(bodyBuffer));
                    consumed = true;
                }
            }
        })
    }

    let response: Response;
    try {
        response = await fetch(request.url, {
            method: request.method,
            body: body,
            cache: "force-cache",
            headers: {
                "x-target-url": request.url
            }
        });
    } catch (error) {
        return { status: "failure-internal", message: extractErrorMessage(error) };
    }

    try {
        return {
            status: "success",
            statusCode: response.status,
            statusText: response.statusText,
            headers: objectHeadersToKv(response.headers),
            payload: await response.arrayBuffer()
        };
    } catch (error) {
        return { status: "failure-internal", message: "body download failed: " + extractErrorMessage(error) };
    }
}

export async function setupLocalProxyClient() {
    if (Platform.OS !== "web") {
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
    private readonly workerContainer: ServiceWorkerContainer;
    private worker: ServiceWorkerRegistration | undefined;

    constructor(worker: ServiceWorkerContainer) {
        this.workerContainer = worker;

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
        await this.initializeWorker();

        const initializeError = await this.executeThrow("initialize", {});
        if (initializeError) {
            throw new Error("initialize failed: " + initializeError);
        }

        await this.setupConnectionParameters();
    }

    async registerRequest({ url, headers }: ImplHttpRequestParameters): Promise<void> {
        /* FIXME: handle error */
        await this.executeThrow("register-request", { url, headers })
    }

    async registerImage(url: string, headers: { [key: string]: string }): Promise<void> {
        /* FIXME: handle error */
        await this.executeThrow("register-image", { url, headers });
    }

    private async setupConnectionParameters() {
        const result = await this.execute("connection-setup", { url: AppSettings.getValue(Setting.WebProxyServerAddress) });
        if (result.status === "failure") {
            this.logger.warn("Failed to setup server connection: %s", result.message);
        } else {
            this.logger.debug("Connection parameter successfully updated/initialized.");
        }
    }

    private async initializeWorker() {
        this.worker = await this.workerContainer.ready;
        this.workerContainer.addEventListener("message", (event: MessageEvent) => {
            if (typeof event.data !== "object") {
                return;
            }

            const { scope } = event.data;
            if (scope !== "web-proxy") {
                /* message is not for us */
                return;
            }

            this.handleWorkerMessage(event.data);
        });
    }

    private handleWorkerMessage(message: any) {
        const { type } = message;
        if (type === "response") {
            const { token, status } = message;
            const request = this.requests[token];
            if (!request) {
                this.logger.warn("Received request response for unknown request %s.", token);
                return;
            }

            if (status === "success") {
                request.callback({ status: "success", result: message.payload });
            } else {
                request.callback({ status: "failure", message: message.message || "unknown error" });
            }
        } else {
            this.logger.warn("Received invalid message type %s.", type);
        }
    }

    private async execute(request: string, payload: any,): Promise<RequestWorkerResult> {
        const token = guuid();
        this.worker?.active!.postMessage({ scope: "web-proxy", type: "request", request, payload, token });

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

    private async executeThrow(request: string, payload: any): Promise<any> {
        const response = await this.execute(request, payload);
        if (response.status !== "success") {
            throw new Error(response.message);
        }

        return response.result;
    }
}
