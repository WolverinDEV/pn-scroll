import { WebSocketServer, WebSocket } from "ws";
import { ImplHttpRequestParameters, ImplHttpResponse } from "../../src/engine/request";
import fetch, { Headers } from "node-fetch";

async function executeRequest(request: ImplHttpRequestParameters) : Promise<ImplHttpResponse> {
    const headers = new Headers();
    for(const header of Object.keys(request.headers)) {
        headers.append(header, request.headers[header]);
    }

    try {
        const response = await fetch(request.url, {
            method: request.method,
            body: request.body as string,
            headers: headers
        });

        return {
            status: response.status === 200 ? "success" : "failure",
            statusCode: response.status,
            statusText: response.statusText,
            headers: { }, /* FIXME: Header! */
            payload: await response.text()
        }
    } catch (error: any) {
        if(error instanceof Error) {
            return {
                status: "failure-internal",
                message: error.message
            };
        }

        return {
            status: "failure-internal",
            message: error.toString()
        };
    }
}

function handleConnection(socket: WebSocket) {
    socket.on("message", (payload: Buffer) => {
        const data = JSON.parse(payload.toString());
        if(data.type === "execute-request") {
            const requestId = data.payload.requestId;
            executeRequest(data.payload.request).then(response => {
                socket.send(JSON.stringify({
                    type: "request-response",
                    payload: {
                        requestId,
                        response
                    }
                }));
            }).catch(error => {
                let message;
                if(error instanceof Error) {
                    message = error.message;
                } else {
                    message = "unknown error has been thrown";
                }

                console.error(error);
                socket.send(JSON.stringify({
                    type: "request-response",
                    payload: {
                        requestId,
                        response: {
                            status: "failure-internal",
                            message: message
                        } as ImplHttpResponse
                    }
                }));
            })
        }
    });
}

const server = new WebSocketServer({
    backlog: 10,
    port: 1334,
});

server.on("connection", (socket, request) => {
    console.error("Received a new request: %s", request.url);
    handleConnection(socket);
});

server.on("error", error => {
    console.error("Failed to start server: %o", error);
    process.exit(1);
});

server.on("listening", () => console.info("Local request proxy started"));
