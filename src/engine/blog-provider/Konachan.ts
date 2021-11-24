import {BlogProvider, FeedFilter, FeedPost, FeedProvider, ImageLoadResult, PostImageInfo} from "../index";
import {executeRequest} from "../request";
import {ensurePageLoaderSuccess} from "./Helper";
import {HTMLElement} from "node-html-parser";
import {
    CacheKey,
    createItemCache,
    ItemCache,
    ItemCacheResolver,
    ResolveOptions,
    ResolveResult,
    ResolverRole
} from "../cache/Cache";
import {MemoryCacheResolver} from "../cache/CacheResolver";
import {extractErrorMessage} from "../../utils";
import {downloadImage} from "../request/Image";

type KonachenPage = {
    navigator: {
        current: number | null,
        max: number | null,
    },

    posts: FeedPost[],
};

export function downloadKonachenImage(url: string): Promise<ImageLoadResult> {
    return downloadImage(url, { });
}

class KonachenPageLoader implements ItemCacheResolver<number, KonachenPage> {
    constructor(readonly url: string) { }

    cached(key: CacheKey<number>): boolean { return false; }
    delete(key: CacheKey<number>): void { }
    save(key: CacheKey<number>, value: KonachenPage): void { }

    name(): string {
        return "Konachen page loader";
    }

    role(): ResolverRole {
        return "resolver";
    }

    private parsePage(container: HTMLElement) : KonachenPage {
        let result: KonachenPage = {
            navigator: {
                current: null,
                max: null
            },
            posts: []
        };

        /* extract the page count */
        {
            const paginator = container.querySelector("#paginator");
            if(!paginator) {
                throw new Error("missing #paginator");
            }

            const em = paginator.querySelector("em");
            if(!em) {
                throw new Error("missing current page highlight");
            }

            const anchors = [...paginator.querySelectorAll("a")]
                .map(entry => parseInt(entry.textContent || ""))
                .filter(entry => !isNaN(entry));

            result.navigator.max = Math.max(...anchors);
            result.navigator.current = parseInt(em.textContent || "");
        }

        /* extract the post entries */
        {
            const posts = container.querySelectorAll("#post-list-posts li");
            for(const postNode of posts) {
                let previewImage: PostImageInfo;
                let detailedImage: PostImageInfo;
                let postUrl: string;

                {
                    const thumbnailNode = postNode.querySelector(".thumb");
                    if(!thumbnailNode) {
                        console.warn("Missing .thumb Node for post.");
                        continue;
                    }
                    postUrl = thumbnailNode.getAttribute("href")!;

                    const thumbnailImageNode = thumbnailNode.querySelector("img");
                    if(!thumbnailImageNode) {
                        console.warn("Missing .thumb > img Node for post.");
                        continue;
                    }

                    const imageUrl = thumbnailImageNode.getAttribute("src")!;
                    previewImage = {
                        identifier: imageUrl,
                        metadata: {},

                        width: parseInt(thumbnailImageNode.getAttribute("width") || ""),
                        height: parseInt(thumbnailImageNode.getAttribute("height") || ""),
                        loadImage: () => downloadKonachenImage(imageUrl)
                    }
                }

                {
                    const directLinkNode = postNode.querySelector(".directlink");
                    if(!directLinkNode) {
                        console.warn("Missing .directlink Node for post.");
                        continue;
                    }

                    const directLinkResNode = directLinkNode.querySelector(".directlink-res");
                    if(!directLinkResNode) {
                        console.warn("Missing .directlink-res Node for post.");
                        continue;
                    }

                    const [ width, height ] = directLinkResNode.textContent!.split("x").map(value => parseInt(value.trim()));

                    const imageUrl = directLinkNode.getAttribute("href")!;
                    detailedImage = {
                        identifier: imageUrl,
                        metadata: {},

                        width: width,
                        height: height,
                        loadImage: () => downloadKonachenImage(imageUrl)
                    }
                }

                result.posts.push({
                    type: "image",
                    images: [{
                        detailed: detailedImage,
                        preview: previewImage,
                        other: []
                    }],
                    metadata: {
                        detailedPostUrl: postUrl
                    }
                });
            }
        }

        return result;
    }

    async resolve(key: CacheKey<number>, options: ResolveOptions<KonachenPage>): Promise<ResolveResult<KonachenPage>> {
        const response = await executeRequest({
            type: "GET",
            url: `https://${this.url}/post`,
            urlParameters: {
                tags: "bondage",
                page: key.key
            },
            responseType: "html"
        });

        if(response.status !== "success") {
            return {
                status: "cache-error",
                message: response.statusText + " (" + response.payload + ")"
            };
        }

        try {
            return {
                status: "cache-hit",
                value: this.parsePage(response.payload),
            };
        } catch (error) {
            return {
                status: "cache-error",
                message: extractErrorMessage(error)
            }
        }
    }
}

class KonachenFeedProvider implements FeedProvider {
    private static kPostsPerSite = 18;
    private pageLoader: ItemCache<number, KonachenPage>;

    constructor(readonly url: string, readonly filter: FeedFilter) {
        this.pageLoader =  createItemCache<number, KonachenPage>(
            page => page.toString(),
            [
                new MemoryCacheResolver(),
                new KonachenPageLoader(url)
            ]
        );
    }

    randomAccessSupported(target: "page" | "entry"): boolean {
        /* page and entry are both supported */
        return true;
    }

    async getEntryCount(): Promise<number> {
        const firstPage = await ensurePageLoaderSuccess(this.pageLoader, 1);
        if(typeof firstPage.navigator.max !== "number") {
            throw "first page misses page count";
        }

        const lastPage = await ensurePageLoaderSuccess(this.pageLoader, firstPage.navigator.max);
        return (firstPage.navigator.max - 1) * KonachenFeedProvider.kPostsPerSite + lastPage.posts.length;
    }

    async getPageCount(): Promise<number> {
        const firstPage = await ensurePageLoaderSuccess(this.pageLoader, 1);
        if(typeof firstPage.navigator.max !== "number") {
            throw "first page misses page count";
        }

        return firstPage.navigator.max;
    }

    async loadEntry(target: number): Promise<FeedPost> {
        return { type: "error", errorType: "not-found" };
    }

    async loadEntryRef(target: any): Promise<FeedPost> {
        return { type: "error", errorType: "not-found" };
    }

    async loadPage(target: number): Promise<FeedPost[]> {
        const page = await ensurePageLoaderSuccess(this.pageLoader, target);
        return page.posts;
    }
}

export class KonachenBlogProvider implements BlogProvider {
    private readonly safeSearch: boolean;

    constructor(safeSearch: boolean) {
        this.safeSearch = safeSearch;
    }

    id(): string {
        return this.url();
    }

    blogName(): string {
        return "Konachan"
    }

    filteredFeed(filter: FeedFilter): FeedProvider {
        return new KonachenFeedProvider(this.url(), filter);
    }

    mainFeed(): FeedProvider {
        return new KonachenFeedProvider(this.url(), { });
    }

    private url() {
        return this.safeSearch ? "konachan.net" : "konachan.com";
    }
}
