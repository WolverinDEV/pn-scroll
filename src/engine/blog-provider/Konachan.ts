import {BlogProvider, FeedFilter, FeedEntry, FeedProvider, SuggestionResult, PostImage} from "../index";
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
import "./KonachenTagGenerator";
import ImageInfo = PostImage.ImageInfo;
const knownTags = import("./KonachenTags.json").then(result => {
    return result.default as KnownTag[];
}).catch(error => {
    console.warn("Failed to load Konachen tags: %o", error);
    return null;
});

type KnownTag = {
    postCount: number,
    name: string,
    type: string
}

type KonachenPage = {
    navigator: {
        current: number | null,
        max: number | null,
    },

    posts: FeedEntry[],
};

class KonachenPageLoader implements ItemCacheResolver<number, KonachenPage> {
    constructor(readonly url: string, readonly filter: FeedFilter) { }

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
                let previewImage: ImageInfo;
                let detailedImage: ImageInfo;
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
                    }
                }

                result.posts.push({
                    type: "image",
                    id: detailedImage.identifier,
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
                tags: (this.filter.includeCategories || []).join("+"),
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
    private readonly pageLoader: ItemCache<number, KonachenPage>;

    constructor(readonly url: string, readonly filter: FeedFilter) {
        this.pageLoader =  createItemCache<number, KonachenPage>(
            page => page.toString(),
            [
                new MemoryCacheResolver(),
                new KonachenPageLoader(url, filter)
            ]
        );
    }

    randomAccessSupported(_target: "page" | "entry"): boolean {
        /* page and entry are both supported */
        return true;
    }

    async getPageCount(): Promise<number> {
        const firstPage = await ensurePageLoaderSuccess(this.pageLoader, 1);
        if(typeof firstPage.navigator.max !== "number") {
            throw "first page misses page count";
        }

        return firstPage.navigator.max;
    }

    async loadPage(target: number): Promise<FeedEntry[]> {
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

    async queryTagSuggestions(text: string, abortSignal: AbortSignal): Promise<SuggestionResult> {
        let tags = await knownTags;
        if(!tags?.length) {
            return { status: "error", message: "failed to load tags" };
        } else if(abortSignal.aborted) {
            return { status: "aborted" };
        }

        const suggestions = [];
        for(const { name } of tags) {
            if(!name.substring(2).toLowerCase().startsWith(text.toLowerCase())) {
                continue;
            }

            suggestions.push(name.substring(2));
            if(suggestions.length > 100) {
                break;
            }
        }

        return {
            status: "success",
            suggestions: suggestions
        };
    }

    loadImage(image: PostImage.ImageInfo): Promise<PostImage.ImageLoadResult> {
        /* downloadImage will cache the images. */
        return downloadImage(image.identifier, { });
    }

    private url() {
        return this.safeSearch ? "konachan.net" : "konachan.com";
    }
}
