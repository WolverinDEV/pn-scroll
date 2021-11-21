import {executeLocalProxyRequest} from "./LocalProxyClient";
import {parsePayloadHtml} from "./ParserHTML";

export type ImplHttpRequestParameters = {
    headers: { [key: string]: string },
    method: "GET" | "POST",
    url: string,
    body: undefined | string | ArrayBuffer
};

export type ImplHttpResponse = {
    status: "success" | "failure"
    headers: { [key: string]: string },

    statusCode: number,
    statusText: string,

    payload: string
} | {
    status: "failure-internal",
    message: string
};

type HttpBaseRequest = {
    url: string,
    urlParameters?: { [key: string]: string },

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
    "binary": Uint8Array,
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
    request: HttpRequest & { responseType: keyof HttpResponseType }
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
                payload: implResponse.payload
            };

        case "success":
            let response;
            try {
                switch (request.responseType) {
                    case "text":
                        response = implResponse.payload;
                        break;

                    case "binary":
                        /* FIXME! */
                        response = implResponse.payload;
                        break;

                    case "html":
                        response = parsePayloadHtml(implResponse.payload);
                        break;

                    case "json":
                        response = JSON.parse(implResponse.payload);
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
