import "./blog-provider/Konachan.ts";

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

export type PostImageLoaded = {
    status: "loaded",
    uri: string,
    headers?: { [key: string]: string }
};

export type PostImageLoadError = {
    status: "error",
    message: string,
};

export type ImageLoadResult = {
    status: "success",
    imageUri: string,

    unload: () => void,
} | {
    status: "failure",
    message: string,
    recoverable?: boolean,
};

export type PostImageInfo = {
    identifier: string,
    metadata: { [key: string]: string },

    width: number | null,
    height: number | null,

    loadImage: () => Promise<ImageLoadResult>,
};

export type PostImage = {
    preview: PostImageInfo | null,
    detailed: PostImageInfo,
    other: PostImageInfo[]
};

export type FeedPostImage = {
    type: "image",
    images: PostImage[],
    metadata: { [key: string]: string }
};

type FeedPostError = {
    type: "error",
} & ({
    errorType: "load-error",
    errorMessage: string
} | {
    errorType: "not-found",
});

export type FeedPost = FeedPostImage | FeedPostError;

export type FeedFilter = {
    text?: string,
    includeCategories?: string[],
    excludeCategories?: string[]
}

export interface FeedProvider {
    /* Random access methods */
    randomAccessSupported(target: "page" | "entry"): boolean;

    loadPage(target: number): Promise<FeedPost[]>;
    getPageCount() : Promise<number>;

    loadEntry(target: number): Promise<FeedPost>;
    getEntryCount() : Promise<number>;

    loadEntryRef(target: any): Promise<FeedPost>;
}

export interface BlogProvider {
    id() : string;
    blogName() : string;
    //blogIcon() : string; /* TODO! */

    mainFeed() : FeedProvider;
    filteredFeed(filter: FeedFilter) : FeedProvider;
}
