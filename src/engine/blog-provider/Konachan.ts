import {BlogProvider, FeedEntry, FeedFilter, FeedProvider} from "../index";
import {extractErrorMessage} from "../../utils";

type KonachenFeedPage = {
    status: "success",

    navigator: {
        current: number,
        max: number,
    },

    /* entries */
} | {
    status: "error",
    message: string
};

type KonachenFeedPageLoading = {
    status: "loading",
    callbacks: (() => void)[]
};

class KonachenFeedProvider implements FeedProvider {
    private pageCache: (KonachenFeedPage | KonachenFeedPageLoading[] = [];

    constructor(readonly filter: FeedFilter) { }

    randomAccessSupported(target: "page" | "entry"): boolean {
        /* page and entry are both supported */
        return true;
    }

    async getEntryCount(): Promise<number | null> {
        const firstPage = await this.loadKonachanPage(1);
        if(firstPage.status !== "success") {
            throw "failed to load first page";
        }

        const lastPage = await this.loadKonachanPage(firstPage.navigator.max);
        if(lastPage.status !== "success") {
            throw "failed to load last page";
        }

        return (firstPage.navigator.max - 1) * 18 /* + entries on the last page! */;
    }

    async getPageCount(): Promise<number | null> {
        const firstPage = await this.loadKonachanPage(1);
        if(firstPage.status !== "success") {
            throw "failed to load first page";
        }
        return firstPage.navigator.max;
    }

    async loadEntry(target: number): Promise<FeedEntry> {
        return undefined;
    }

    loadEntryRef(target: any): Promise<FeedEntry> {
        return Promise.resolve(undefined);
    }

    loadPage(target: number): Promise<FeedEntry[]> {
        return Promise.resolve([]);
    }

    private async loadKonachanPage(target: number): Promise<KonachenFeedPage> {
        if(typeof this.pageCache[target] !== "undefined") {
            const entry = this.pageCache[target];
            if(entry.status === "loading") {
                await new Promise<void>(resolve => entry.callbacks.push(resolve));
            }

            /* We have to use the new object and not entry! */
            return this.pageCache[target];
        }

        const loadingEntry: KonachenFeedPage & { status: "loading" } = this.pageCache[target] = {
            status: "loading",
            callbacks: []
        };

        try {
            /* TODO: load entry */
            throw "not implemented";
        } catch (error) {
            this.pageCache[target] = {
                status: "error",
                message: extractErrorMessage(error)
            }
        }

        for(const callback of loadingEntry.callbacks) {
            callback();
        }
        return this.pageCache[target];
    }
}

export class KonachenBlogProvider implements BlogProvider {
    private readonly safeSearch: boolean;

    constructor(safeSearch: boolean) {
        this.safeSearch = safeSearch;
    }

    id(): string {
        return this.safeSearch ? "konachan.net" : "konachan.com";
    }

    blogName(): string {
        return "Konachan"
    }

    filteredFeed(filter: FeedFilter): FeedProvider {
        return undefined;
    }

    mainFeed(): FeedProvider {
        return undefined;
    }

}
