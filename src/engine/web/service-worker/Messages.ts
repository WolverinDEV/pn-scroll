import {getLogger} from "../../../Log";
import {extractErrorMessage} from "../../../utils";
import {ProxyRequestClient} from "./ProxyClient";
import {ImplHttpRequestParameters, ImplHttpResponse} from "../../request";
import {registeredImages} from "./Worker";

const logger = getLogger("message-handler");
self.addEventListener("message", event => {
    if(typeof event !== "object") {
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
        if(!(request in requestHandler)) {
            sendResponse({ type: "response", token, status: "failure", message: "invalid request type" });
            return;
        }

        // logger.debug("Executing request: %s", request);
        requestHandler[request](payload).then(result => {
            sendResponse({ type: "response", token, status: "success", payload: result });
        }).catch(error => {
            sendResponse({ type: "response", token, status: "failure", message: extractErrorMessage(error) });
        });
    } else {
        logger.warn("Invalid message type: %o", type);
    }
});

const requestHandler: {
    [key: string]: (payload: any) => Promise<any>
} = {};

export let requestClient: ProxyRequestClient | undefined;

requestHandler["initialize"] = async () => {
    logger.info("Worker successfully initialized!");
};

requestHandler["connection-setup"] = async ({ url }: { url: string }) => {
    logger.info("Using proxy server url %s.", url);

    requestClient?.destroy();
    requestClient = new ProxyRequestClient(url);
    requestClient.executeConnect();
    /* TODO: Try to connect sync once and return the status to our host. */
};

requestHandler["proxy-request"] = async (request: ImplHttpRequestParameters): Promise<ImplHttpResponse> => {
    if(!requestClient) {
        return { status: "failure-internal", message: "missing request client" };
    }

    return await requestClient.execute(request);
}

requestHandler["register-image"] = async ({ url, headers }) => {
    registeredImages[url] = {
        url,
        headers
    };
}
