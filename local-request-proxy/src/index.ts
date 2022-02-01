import { WebSocket, WebSocketServer } from "ws";
import { ImplHttpRequestParameters, ImplHttpResponse } from "../../src/engine/request";
import { extractErrorMessage } from "../../src/utils";
import { BufferInputStream, BufferOutputStream } from "../../src/engine/buffer/Buffer";
import fetch, { Headers } from "node-fetch";
import fs from "fs";
import net from "net";
import http from "http";
import https from "https";

async function executeRequest(request: Omit<ImplHttpRequestParameters, "body"> & { body: Buffer }): Promise<ImplHttpResponse> {
    const headers = new Headers();
    for (const header of Object.keys(request.headers)) {
        headers.append(header, request.headers[header]);
    }

    try {
        const response = await fetch(request.url, {
            method: request.method,
            body: request.body,
            headers: headers
        });

        const responseHeaders: { [key: string]: string } = {};
        for (const key of response.headers.keys()) {
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
        if (error instanceof Error) {
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
            result.writeUInt8(response.status === "success" ? 0 : 1);
            +
                result.writeUInt32LE(response.statusCode);
            result.writeVarString(response.statusText);

            const headers = Object.keys(response.headers);
            result.writeUInt32LE(headers.length);
            for (const key of headers) {
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

        if (!requestHandler[requestTypeId]) {
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


async function setupWebSocketServer(httpServer: http.Server) {
    const wsServer = new WebSocketServer({ server: httpServer });
    wsServer.on("connection", (socket, request) => {
        console.error("[%s] Web socket connection received (Request path: %s).", request.socket.remoteAddress, request.url);
        handleConnection(socket);
    });

    wsServer.on("error", error => {
        console.error("Web socket server error: %o", error);
        process.exit(1);
    });
}

/* Setup plain server */
console.info("Starting");

const serverPort = 8055;
const server: {
    [key in "http" | "https"]?: http.Server
} = {};

server["http"] = http.createServer({});
setupWebSocketServer(server["http"]).then(() => {
    console.info("Local request proxy started on ws://localhost:" + serverPort);
});

if ("SSL_CERTIFICATE" in process.env && "SSL_KEY" in process.env) {
    const certificatePath = process.env.SSL_CERTIFICATE as string;
    const keyPath = process.env.SSL_KEY as string;


    server["https"] = https.createServer({
        cert: fs.readFileSync(certificatePath),
        key: fs.readFileSync(keyPath),
    });
    setupWebSocketServer(server["https"]).then(() => {
        console.info("Local secure request proxy started on wss://localhost:" + serverPort);
    });
}


const socketServer = net.createServer(socket => {
    console.debug("[%s] Connection accepted.", socket.remoteAddress);
    socket.once('data', buffer => {
        // Pause the socket
        socket.pause();

        let byte = buffer[0];
        let protocol: keyof typeof server;
        if (byte === 22) {
            protocol = "https";
        } else if (32 < byte && byte < 127) {
            protocol = "http";
        } else {
            console.warn("[%s] First packet does not contain http nor https info. Closing socket.", socket.remoteAddress);
            socket.destroy();
            return;
        }

        console.debug("[%s] Client wants to used %s.", socket.remoteAddress, protocol);
        let proxy = server[protocol];
        if (proxy) {
            socket.unshift(buffer);
            proxy.emit('connection', socket);
        }

        process.nextTick(() => socket.resume());
    });
});
socketServer.listen(serverPort, () => console.info("Net server started listening on %d", serverPort));
socketServer.on("error", err => {
    throw err;
});
