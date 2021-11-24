/* Communicate with the local request server to make HTTP(S) requests */
import {ImplHttpRequestParameters, ImplHttpResponse} from "./index";
import {BufferInputStream, BufferOutputStream} from "../Buffer";
import {AppSettings, Setting} from "../../Settings";
import {Platform} from "react-native";

let targetUrl: string;
let socket: WebSocket | undefined;

type PendingRequest = {
    callback: (response: RequestResult) => void,
    timeoutId: any
};

let requestIdIndex = 1;
const pendingRequests: PendingRequest[] = [];
const connectedOneshotCallbacks: (() => void)[] = [];

function generateRequestId() : number {
    if(requestIdIndex === 0) {
        requestIdIndex++;
    }

    const id = requestIdIndex;
    requestIdIndex = (requestIdIndex + 1) & 0xFFFFFFFF;
    return id;
}

type RequestResult = {
    status: "success",
    payload: Buffer
} | {
    status: "not-connected" | "timeout" | "unknown-request"
} | {
    status: "execute-exception",
    message: string
}

function executeRequest(code: number, payload: Buffer) : Promise<RequestResult> {
    let requestId = generateRequestId();

    return new Promise<RequestResult>(resolve => {
        if(socket?.readyState !== WebSocket.OPEN) {
            resolve({ status: "not-connected" });
            return;
        }

        const writer = new BufferOutputStream();
        writer.writeUInt32LE(0x01);
        writer.writeUInt32LE(requestId);
        writer.writeBuffer(payload);
        socket.send(writer.arrayBuffer());

        pendingRequests[requestId] = {
            callback: result => {
                if(requestId in pendingRequests) {
                    clearTimeout(pendingRequests[requestId].timeoutId);
                    delete pendingRequests[requestId];
                    resolve(result);
                }
            },
            timeoutId: setTimeout(() => pendingRequests[requestId]?.callback({ status: "timeout" }), 15_000)
        }
    });
}

export async function executeLocalProxyRequest(request: ImplHttpRequestParameters) : Promise<ImplHttpResponse> {
    console.info("Proxy request for %s", request.url);

    const writer = new BufferOutputStream();
    writer.writeVarString(JSON.stringify({
        ...request,
        body: undefined
    }));
    if(request.body) {
        writer.writeUInt32LE(request.body.byteLength);
        writer.writeArrayBuffer(request.body);
    } else {
        writer.writeUInt32LE(0);
    }

    const response = await executeRequest(0x01, writer.buffer());
    switch (response.status) {
        case "not-connected":
            return { status: "failure-internal", message: "proxy disconnected (" + socket?.readyState + ")" };

        case "execute-exception":
            return { status: "failure-internal", message: "execute exception: " + response.message };

        case "timeout":
            return { status: "failure-internal", message: "timeout" };

        case "success":
            break;

        case "unknown-request":
        default:
            return { status: "failure-internal", message: "unknown internal communication error (" + response.status + ")" };
    }

    const reader = new BufferInputStream(response.payload);
    const status = reader.readUInt8();
    switch (status) {
        case 0:
        case 1:
            const statusCode = reader.readUInt32LE();
            const statusText = reader.readVarString();

            const headers: { [key: string]: string } = {};
            const headerCount = reader.readUInt32LE();
            for(let i = 0; i < headerCount; i++) {
                const key = reader.readVarString();
                headers[key] = reader.readVarString();
            }

            const payloadLength = reader.readUInt32LE();
            const payload = reader.readArrayBuffer(payloadLength);

            return {
                status: status === 1 ? "failure" : "success",
                headers,
                payload,
                statusCode,
                statusText
            };

        case 2:
            return {
                status: "failure-internal",
                message: reader.readVarString()
            };

        default:
            return {
                status: "failure-internal",
                message: "invalid server status (" + status + ")"
            };
    }
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
    executeDisconnect(3001, "starting new connection");
    let localSocket = new WebSocket(targetUrl);
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
    for(const callback of connectedOneshotCallbacks.splice(0, connectedOneshotCallbacks.length)) {
        callback();
    }
}

function handleSocketError(eventSocket: WebSocket, error: any) {
    if(eventSocket !== socket) {
        return;
    }

    console.error("Having error from local request proxy");
    /* TODO: Reconnect */
}

async function handleSocketMessage(eventSocket: WebSocket, message: any) {
    if(message instanceof Blob) {
        message = await message.arrayBuffer();
    }
    if(!(message instanceof ArrayBuffer)) {
        throw "expected a binary message";
    }

    const reader = new BufferInputStream(Buffer.from(message));

    const requestId = reader.readUInt32LE();
    if(requestId === 0) {
        console.error("Currently not possible to handle notifies");
        /* notify */
        return;
    }

    if(requestId in pendingRequests) {
        const request = pendingRequests[requestId];
        const statusCode = reader.readUInt32LE();

        switch(statusCode) {
            case 0:
                request.callback({ status: "success", payload: reader.remainingBuffer() });
                break;

            case 0xFE:
                request.callback({ status: "execute-exception", message: reader.readVarString() });
                break;

            case 0xFF:
                request.callback({ status: "unknown-request" });
                break;

            default:
                request.callback({ status: "execute-exception", message: "invalid server request status code (" + statusCode + ")" });
                break;
        }
    } else {
        console.warn("Having request response for unknown request: %d", requestId);
    }
}

function handleSocketDisconnected(eventSocket: WebSocket, event: any) {
    if(eventSocket !== socket) {
        return;
    }

    console.error("Local request proxy disconnected.")
    /* TODO: Reconnect */
}

export async function setupLocalProxyClient() {
    if(Platform.OS !== "web") {
        /* We don't initialize it */
        return;
    }

    targetUrl = AppSettings.getValue(Setting.WebProxyServerAddress);
    executeConnect();

    AppSettings.registerChangeCallback(Setting.WebProxyServerAddress, address => {
        console.info("Web proxy server address changed. Reestablishing connection.");
        targetUrl = address;
        executeConnect();
    });

    await Promise.race([
        new Promise<void>(resolve => connectedOneshotCallbacks.push(resolve)),
        new Promise<void>(resolve => { setTimeout(resolve, 5000); })
    ]);
}
