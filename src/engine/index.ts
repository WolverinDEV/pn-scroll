import {executeRequest} from "./request";

/*
setTimeout(() => {
    executeRequest({
        type: "GET",
        url: "https://konachan.net/post?tags=sword",
        responseType: "html"
    }).then(result => {
        if(result.status !== "success") {
            console.error("Invalid response: %o", result.status);
            return;
        }

        const dom = result.payload as Document;
        console.error("Request result: %o", dom.body.innerText);
        console.error("Max pages: %s", dom.querySelector("#paginator > div > a:nth-child(9)")!.textContent)
    });
}, 1000);
*/

type FeedEntryImage = {
    type: "image",
    url: string,

    /* TODO: Preview modes */
};

type FeedEntryError = {
    type: "error",
} & ({
    errorType: "load-error",
    errorMessage: string
} | {
    errorType: "not-found",
});

export type FeedEntry = FeedEntryImage | FeedEntryError;

export type FeedFilter = {
    text?: string,
    includeCategories?: string[],
    excludeCategories?: string[]
}

export interface FeedProvider {
    /* Random access methods */
    randomAccessSupported(target: "page" | "entry"): boolean;

    loadPage(target: number): Promise<FeedEntry[]>;
    getPageCount() : Promise<number | null>;

    loadEntry(target: number): Promise<FeedEntry>;
    getEntryCount() : Promise<number | null>;

    loadEntryRef(target: any): Promise<FeedEntry>;
}

export interface BlogProvider {
    id() : string;
    blogName() : string;
    //blogIcon() : string; /* TODO! */

    mainFeed() : FeedProvider;
    filteredFeed(filter: FeedFilter) : FeedProvider;
}
