import {JSDOM} from "jsdom";

export function parsePayloadHtml(html: string) : Document {
    const dom = new JSDOM(html);
    return dom.window.document;
}
