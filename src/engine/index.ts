import {SearchParseResult} from "./Search";

export namespace PostImage {
    export type ImageLoadResult = {
        status: "success",
        imageUri: string,

        unload: () => void,
    } | {
        status: "failure",
        message: string,
        recoverable?: boolean,
    };

    export type ImageInfo = {
        identifier: string,
        metadata: { [key: string]: string },

        width: number | null,
        height: number | null,
    };
}

export type PostImage = {
    preview: PostImage.ImageInfo | null,
    detailed: PostImage.ImageInfo,
    other: PostImage.ImageInfo[]
};

export type FeedEntryImage = {
    type: "image",

    id: string,

    /**
     * Images supplied for the feed entry.
     */
    images: PostImage[],

    /**
     * Additional metadata which can be used by the feed generator or image loader.
     */
    metadata: { [key: string]: string }
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

export type SuggestionResult = {
    status: "success",
    suggestions: string[]
} | {
    status: "aborted"
} | {
    status: "error",
    message: string
};

export interface FeedProvider {
    /**
     * Page 1 contains the oldest posts and page `getPageCount` contains the newest posts.
     * @param target
     */
    /* TODO: Some kind of page result including an error, a recoverable error, eof and a success */
    loadPage(target: number): Promise<FeedEntry[]>;

    /**
     * @returns number the amount of pages this feed contains or null if it's a endless feed.
     */
    getPageCount() : Promise<number>;
}

export type SearchHint = {
    type: "error" | "warning",
    message: string
};

export interface BlogProvider {
    /* FIXME: id() might be miss leading since the BlogRegistry uses different ids */
    id() : string;
    blogName() : string;
    //blogIcon() : string; /* TODO! */

    mainFeed() : FeedProvider;
    filteredFeed(filter: FeedFilter) : FeedProvider;

    /**
     * Query suggestions for the tag auto completion.
     * @param text Current prefix of the text
     * @param abortSignal A signal to abort the query
     */
    queryTagSuggestions(text: string, abortSignal: AbortSignal) : Promise<SuggestionResult>;

    analyzeSearch(search: SearchParseResult, abortSignal: AbortSignal) : Promise<SearchHint[]>;

    /**
     * Load/download an image in order to display it.
     * @param image The target image.
     */
    loadImage(image: PostImage.ImageInfo): Promise<PostImage.ImageLoadResult>;
}
