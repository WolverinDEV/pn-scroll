import {getLogger} from "../../../Log";
import {extractErrorMessage} from "../../../utils";
import {ProxyRequestClient} from "./ProxyClient";

const logger = getLogger("message-handler");
class MessageHandler {
    private readonly requestHandler: { [key: string]: (payload: any) => Promise<any> };
    private readonly listener: any;

    constructor() {
        this.requestHandler = {};
        this.listener = (event: MessageEvent) => this.handleMessage(event);
    }

    initialize() {
        self.addEventListener("message", this.listener);
    }

    destroy() {
        self.removeEventListener("message", this.listener);
    }

    registerHandler(type: string, handler: (payload: any) => Promise<any>) {
        this.requestHandler[type] = handler;
    }

    private handleMessage(event: MessageEvent) {
        if(typeof event.data !== "object") {
            return;
        }

        const { scope, type } = event.data;
        if(scope !== "web-proxy") {
            /* message is not for us */
            return;
        }

        const source = event.source;
        const sendResponse = (message: any) => {
            message = { scope: "web-proxy", ...message };
            if(source) {
                source.postMessage(message);
            } else {
                self.postMessage(message);
            }
        };

        if(type === "request") {
            const { request, payload, token } = event.data;
            if(!(request in this.requestHandler)) {
                sendResponse({ type: "response", token, status: "failure", message: "invalid request type" });
                return;
            }

            logger.debug("Executing request: %s", request);
            this.requestHandler[request](payload).then(result => {
                sendResponse({ type: "response", token, status: "success", payload: result });
            }).catch(error => {
                sendResponse({ type: "response", token, status: "failure", message: extractErrorMessage(error) });
            });
        } else {
            logger.warn("Invalid message type: %o", type);
        }
    }
}

export const messageHandler = new MessageHandler();
messageHandler.initialize();

export let requestClient: ProxyRequestClient | undefined;

messageHandler.registerHandler("initialize", async () => {
    logger.info("Worker successfully initialized!");
});

messageHandler.registerHandler("connection-setup", async ({ url }: { url: string }) => {
    logger.info("Using proxy server url %s.", url);

    requestClient?.destroy();
    requestClient = new ProxyRequestClient(url);
    requestClient.executeConnect();
    /* TODO: Try to connect sync once and return the status to our host. */
});
