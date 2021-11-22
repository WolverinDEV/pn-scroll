import { WebSocketServer, WebSocket } from "ws";
import { ImplHttpRequestParameters, ImplHttpResponse } from "../../src/engine/request";
import fetch, { Headers } from "node-fetch";
import {BufferInputStream, BufferOutputStream} from "../../src/engine/Buffer";
import {extractErrorMessage} from "../../src/utils";

async function executeRequest(request: Omit<ImplHttpRequestParameters, "body"> & { body: Buffer }) : Promise<ImplHttpResponse> {
    const headers = new Headers();
    for(const header of Object.keys(request.headers)) {
        headers.append(header, request.headers[header]);
    }

    try {
        const response = await fetch(request.url, {
            method: request.method,
            body: request.body,
            headers: headers
        });

        const responseHeaders: { [key: string]: string } = {};
        for(const key of response.headers.keys()) {
            responseHeaders[key] = response.headers.get(key)!;
        }

        return {
            status: response.status === 200 ? "success" : "failure",
            statusCode: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            payload: await response.arrayBuffer()
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

type RequestHandler = (socket: WebSocket, reader: BufferInputStream) => Promise<Buffer>;
const requestHandler: RequestHandler[] = [];
requestHandler[1] = async (socket, reader) => {
    const header = JSON.parse(reader.readVarString());
    const body = reader.readBuffer(reader.readUInt32LE());

    const response = await executeRequest(Object.assign(header, {
        body: body.length === 0 ? undefined : body
    }));

    const result = new BufferOutputStream();
    switch (response.status) {
        case "failure":
        case "success":
            result.writeUInt8(response.status === "success" ? 0 : 1);+
            result.writeUInt32LE(response.statusCode);
            result.writeVarString(response.statusText);

            const headers = Object.keys(response.headers);
            result.writeUInt32LE(headers.length);
            for(const key of headers) {
                result.writeVarString(key);
                result.writeVarString(response.headers[key]);
            }

            result.writeUInt32LE(response.payload.byteLength);
            result.writeArrayBuffer(response.payload);
            break;

        case "failure-internal":
            result.writeUInt8(2);
            result.writeVarString(response.message);
            break;

        default:
            throw "invalid result";
    }

    return result.buffer();
};

function handleConnection(socket: WebSocket) {
    socket.on("message", (payload: Buffer) => {
        const reader = new BufferInputStream(payload);
        const requestTypeId = reader.readUInt32LE();
        const requestId = reader.readUInt32LE();

        if(!requestHandler[requestTypeId]) {
            const writer = new BufferOutputStream();
            writer.writeUInt32LE(requestId);
            writer.writeUInt32LE(0xFF);
            writer.writeVarString("missing request handler");
            socket.send(writer.buffer());
            return;
        }

        requestHandler[requestTypeId](socket, reader).then(result => {
            const writer = new BufferOutputStream();
            writer.writeUInt32LE(requestId);
            writer.writeUInt32LE(0x00);
            writer.writeBuffer(result);
            socket.send(writer.buffer());
        }).catch(error => {
            const writer = new BufferOutputStream();
            writer.writeUInt32LE(requestId);
            writer.writeUInt32LE(0xFE);
            writer.writeVarString(extractErrorMessage(error));
            socket.send(writer.buffer());
        });
    });
}

const server = new WebSocketServer({
    backlog: 10,
    port: 8055,
    host: "0.0.0.0"
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
