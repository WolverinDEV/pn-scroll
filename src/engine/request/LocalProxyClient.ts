/* Communicate with the local request server to make HTTP(S) requests */
import {ImplHttpRequestParameters, ImplHttpResponse} from "./index";
import { v4 as uuidv4 } from 'uuid';

let targetUrl: string;
let socket: WebSocket | undefined;

type PendingRequest = {
    callbackSuccess: (response: ImplHttpResponse) => void,
    callbackFailure: (response: ImplHttpResponse) => void,
    timeoutId: any
};
const pendingRequests: { [key: string]: PendingRequest } = { };

export function executeLocalProxyRequest(request: ImplHttpRequestParameters) : Promise<ImplHttpResponse> {
    const requestId = uuidv4();
    return new Promise<ImplHttpResponse>((resolve, reject: (value: ImplHttpResponse) => void) => {
        if(socket?.readyState !== WebSocket.OPEN) {
            reject({ status: "failure-internal", message: "proxy disconnected (" + socket?.readyState + ")" });
            return;
        }

        socket.send(JSON.stringify({
            type: "execute-request",
            payload: {
                request: request,
                requestId: requestId
            }
        }));

        pendingRequests[requestId] = {
            callbackSuccess: resolve,
            callbackFailure: reject,
            timeoutId: setTimeout(() => {
                const callbackFailure = pendingRequests[requestId]?.callbackFailure;
                delete pendingRequests[requestId];
                if(callbackFailure) {
                    callbackFailure({
                        status: "failure-internal",
                        message: "local server timeout"
                    });
                }
            }, 15_000)
        }
    });
}

function executeDisconnect(code?: number, reason?: string) {
    if(!socket) {
        return;
    }

    const oldSocket = socket;
    socket = undefined;

    try {
        oldSocket.close(code, reason);
    } catch (error) {
        console.warn(error);
    }
}

function executeConnect() {
    executeDisconnect(1001, "starting new connection");
    let localSocket = new WebSocket(`ws://${targetUrl}/`);
    localSocket.onopen = () => handleSocketConnected(localSocket);
    localSocket.onmessage = event => handleSocketMessage(localSocket, event.data);
    localSocket.onerror = event => handleSocketError(localSocket, event);
    localSocket.onclose = event => handleSocketDisconnected(localSocket, event);
    socket = localSocket;
}

function handleSocketConnected(eventSocket: WebSocket) {
    if(eventSocket !== socket) {
        return;
    }

    console.debug("Local request proxy has connected.");
}

function handleSocketError(eventSocket: WebSocket, error: any) {
    if(eventSocket !== socket) {
        return;
    }

    console.error("Having error from local request proxy");
    /* TODO: Reconnect */
}

function handleSocketMessage(eventSocket: WebSocket, message: string) {
    let command;
    try {
        command = JSON.parse(message);
    } catch (error) {
        console.warn("Failed to decode local request proxy message: %s", message);
        return;
    }

    /* TODO: Validate structure? */
    if(command.type === "request-response") {
        const { requestId, response } = command.payload;
        if(requestId in pendingRequests) {
            const request = pendingRequests[requestId];
            delete pendingRequests[requestId];

            clearTimeout(request.timeoutId);
            request.callbackSuccess(response);
        } else {
            console.warn("Received request response for unknown request with id %s", requestId);
        }
    }
}

function handleSocketDisconnected(eventSocket: WebSocket, event: any) {
    console.error("Local request proxy disconnected.")
    /* TODO: Reconnect */
}

function setup() {
    targetUrl = "localhost:1334";
    executeConnect();
}


setup();
