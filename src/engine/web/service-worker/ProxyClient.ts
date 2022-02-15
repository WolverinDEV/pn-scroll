import {extractErrorMessage} from "../../../utils";
import { getLogger, Logger } from "../../../Log";
import {ImplHttpRequestParameters, ImplHttpResponse} from "../../request";
import { BufferInputStream, BufferOutputStream } from "../../buffer/Buffer";

type RequestResult = {
    status: "success",
    payload: Buffer
} | {
    status: "not-connected" | "timeout" | "unknown-request"
} | {
    status: "execute-exception",
    message: string
}

type PendingRequest = {
    callback: (response: RequestResult) => void,
    timeoutId: any
};

/* TODO: Proper reconnect and connection status updates! */
export class ProxyRequestClient {
    private readonly logger: Logger;
    private readonly targetUrl: string;
    private socket: WebSocket | undefined;

    private requestIdIndex = 1;
    private readonly pendingRequests: PendingRequest[] = [];

    constructor(targetUrl: string) {
        this.logger = getLogger("request-proxy-client");
        this.targetUrl = targetUrl;
    }

    destroy() {
        this.executeDisconnect();
    }

    async execute(request: ImplHttpRequestParameters) : Promise<ImplHttpResponse> {
        this.logger.debug("Proxy request for %s", request.url);

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

        const response = await this.executeRequest(0x01, writer.buffer());
        switch (response.status) {
            case "not-connected":
                return { status: "failure-internal", message: "proxy disconnected (" + this.socket?.readyState + ")" };

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

    executeConnect() {
        this.executeDisconnect(3001, "starting new connection");
        try {
            let localSocket = new WebSocket(this.targetUrl);
            localSocket.onopen = () => {
                if(localSocket !== this.socket) {
                    return;
                }

                this.handleSocketConnected();
            };

            localSocket.onmessage = event => {
                if(localSocket !== this.socket) {
                    return;
                }

                this.handleSocketMessage(event.data);
            };

            localSocket.onerror = event => {
                if(localSocket !== this.socket) {
                    return;
                }

                this.handleSocketError(event);
            };

            localSocket.onclose = event => {
                if(localSocket !== this.socket) {
                    return;
                }

                this.handleSocketDisconnected(event);
            };
            this.socket = localSocket;
        } catch (error) {
            this.logger.error("Failed to start new web socket connection to %s: %s", this.targetUrl, extractErrorMessage(error));
            this.socket = undefined;
        }
    }

    executeDisconnect(code?: number, reason?: string) {
        if(!this.socket) {
            return;
        }

        const oldSocket = this.socket;
        this.socket = undefined;

        try {
            oldSocket.close(code, reason);
        } catch (error) {
            this.logger.warn("Failed to close socket: %o", error);
        }
    }

    private generateRequestId() : number {
        if(this.requestIdIndex === 0) {
            this.requestIdIndex++;
        }

        const id = this.requestIdIndex;
        this.requestIdIndex = (this.requestIdIndex + 1) & 0xFFFFFFFF;
        return id;
    }

    private executeRequest(code: number, payload: Buffer) : Promise<RequestResult> {
        let requestId = this.generateRequestId();

        return new Promise<RequestResult>(resolve => {
            if(this.socket?.readyState !== WebSocket.OPEN) {
                resolve({ status: "not-connected" });
                return;
            }

            const writer = new BufferOutputStream();
            writer.writeUInt32LE(code);
            writer.writeUInt32LE(requestId);
            writer.writeBuffer(payload);
            this.socket.send(writer.arrayBuffer());

            this.pendingRequests[requestId] = {
                callback: result => {
                    if(requestId in this.pendingRequests) {
                        clearTimeout(this.pendingRequests[requestId].timeoutId);
                        delete this.pendingRequests[requestId];
                        resolve(result);
                    }
                },
                timeoutId: setTimeout(() => this.pendingRequests[requestId]?.callback({ status: "timeout" }), 15_000)
            }
        });
    }

    private handleSocketConnected() {
        this.logger.debug("Local request proxy has connected.");
    }

    private handleSocketError(_error: any) {
        this.logger.error("Having error from local request proxy");
        /* TODO: Reconnect */
    }

    private async handleSocketMessage(message: any) {
        if(message instanceof Blob) {
            message = await message.arrayBuffer();
        }

        if(!(message instanceof ArrayBuffer)) {
            this.logger.warn("Expected binary message but received: %o", message);
            return;
        }

        const reader = new BufferInputStream(Buffer.from(message));

        const requestId = reader.readUInt32LE();
        if(requestId === 0) {
            this.logger.error("Currently not possible to handle notifies");
            /* notify */
            return;
        }

        if(requestId in this.pendingRequests) {
            const request = this.pendingRequests[requestId];
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
            this.logger.warn("Having request response for unknown request: %d", requestId);
        }
    }

    private handleSocketDisconnected(_event: any) {
        this.logger.error("Local request proxy disconnected.")
        /* TODO: Reconnect */
    }
}
