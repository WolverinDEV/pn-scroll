import {getLogger} from "../../../Log";
import {extractErrorMessage} from "../../../utils";
import {ProxyRequestClient} from "./Client";
import {ImplHttpRequestParameters, ImplHttpResponse} from "../index";
import {downloadImage} from "./Images";

const logger = getLogger("local-proxy-worker");

self.onmessage = event => {
    const source = event.source;
    const sendResponse = (message: any) => {
        if(source) {
            source.postMessage(message);
        } else {
            postMessage(message);
        }
    };

    if(typeof event.data !== "object") {
        logger.warn("Received invalid message payload: %o", event.data);
        return;
    }

    const { type } = event.data;
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
}

const requestHandler: {
    [key: string]: (payload: any) => Promise<any>
} = {};

let requestClient: ProxyRequestClient | undefined;

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

requestHandler["download-image"] = async ({ url, headers }) => {
    const result = await downloadImage(requestClient, url, headers);
    if(result.status === "success") {
        // @ts-ignore
        delete result["unload"];
    }
    return result;
}
