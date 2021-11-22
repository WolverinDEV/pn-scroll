import { executeLocalProxyRequest } from "./LocalProxyClient";
import { parsePayloadHtml } from "./ParserHTML";

export type ImplHttpRequestParameters = {
    headers: { [key: string]: string },
    method: "GET" | "POST",
    url: string,
    body: undefined | ArrayBuffer
};

export type ImplHttpResponse = {
    status: "success" | "failure"
    headers: { [key: string]: string },

    statusCode: number,
    statusText: string,

    payload: ArrayBuffer
} | {
    status: "failure-internal",
    message: string
};

type HttpBaseRequest = {
    url: string,
    urlParameters?: { [key: string]: string | number },

    headers?: { [key: string]: string },
};

type HttpGetRequest = HttpBaseRequest & {
    type: "GET"
};

type HttpPostRequest = HttpBaseRequest & {
    type: "POST",

    /**
     * Objects will be serialized as json-objects.
     * If the "content-type" header hasn't been set it will be set to "application/json".
     */
    payload: string | object
};

export type HttpRequest = HttpGetRequest | HttpPostRequest;

interface HttpResponseType {
    "json": object,
    "html": Document,
    "binary": ArrayBuffer,
    "text": string
}

type HttpResponseBase = {
    headers: { [key: string]: string },
};

type HttpResponseSuccess<R> = HttpResponseBase & {
    status: "success",
    statusCode: 200,
    statusText: "ok",

    payload: R
};

type HttpResponseFailure = HttpResponseBase & {
    status: "failure",
    statusCode: number,
    statusText: string,

    payload: string,
}

export type HttpResponse<R> = HttpResponseSuccess<R> | HttpResponseFailure;

export async function executeRequest<R extends keyof HttpResponseType>(
    request: HttpRequest & { responseType: R }
) : Promise<HttpResponse<HttpResponseType[R]>> {
    const implRequest: ImplHttpRequestParameters = {
        body: undefined,
        headers: Object.assign({}, request.headers),
        method: request.type,
        url: "__error"
    };

    implRequest.url = request.url;
    if(request.urlParameters) {
        implRequest.url += "?";
        implRequest.url += Object.keys(request.urlParameters).map(key => (
            `${key}=${encodeURIComponent(request.urlParameters![key])}`
        )).join("&");
    }

    if(request.type === "POST") {
        switch(typeof request.payload) {
            case "object": {
                const value = JSON.stringify(request.payload);
                implRequest.headers["content-type"] = "application/json";
                implRequest.headers["content-length"] = value.length.toString();
                break;
            }

            case "string": {
                implRequest.headers["content-length"] = request.payload.length.toString();
                break;
            }

            default: {
                implRequest.headers["content-length"] = "0";
                break;
            }
        }
    }

    if(implRequest.headers["User-Agent"]) {
        implRequest.headers["User-Agent"] = "Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1";
    }

    const implResponse = await executeLocalProxyRequest(implRequest);
    switch (implResponse.status) {
        case "failure-internal":
            return {
                status: "failure",
                statusCode: 900,
                statusText: "internal request failure",
                headers: { },
                payload: implResponse.message
            };

        case "failure":
            return {
                status: "failure",
                statusCode: implResponse.statusCode,
                statusText: implResponse.statusText,
                headers: implResponse.headers,
                payload: await arrayBuffer2String(implResponse.payload)
            };

        case "success":
            let response;
            try {
                switch (request.responseType) {
                    case "text":
                        response = await arrayBuffer2String(implResponse.payload);
                        break;

                    case "binary":
                        response = implResponse.payload;
                        break;

                    case "html":
                        response = parsePayloadHtml(await arrayBuffer2String(implResponse.payload));
                        break;

                    case "json":
                        response = JSON.parse(await arrayBuffer2String(implResponse.payload));
                        break;

                    default:
                        throw "invalid response type";
                }
            } catch (error: any) {
                let message: string;
                if(error instanceof Error) {
                    message = error.message;
                } else if(typeof error === "string") {
                    message = error;
                } else {
                    message = "lookup the console";
                    console.error(error);
                }

                return {
                    status: "failure",
                    statusCode: 902,
                    statusText: "failed to parse response",
                    headers: implResponse.headers,
                    payload: message
                };
            }

            return {
                status: "success",
                statusCode: implResponse.statusCode as 200,
                statusText: implResponse.statusText as "ok",
                headers: implResponse.headers,
                payload: response
            };
    }
}

function string2ArrayBuffer(value: string) : Promise<ArrayBuffer> {
    const blob = new Blob([ value ], { type: 'text/plain; charset=utf-8' });
    return blob.arrayBuffer();
}

function arrayBuffer2String(buffer: ArrayBuffer) : Promise<string> {
    const blob = new Blob([ buffer ], { type: 'text/plain; charset=utf-8' });
    return blob.text();
}