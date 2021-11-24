import {
    BlogProvider,
    FeedFilter,
    FeedPost,
    FeedProvider, ImageLoadResult,
    PostImage,
} from "../index";
import {ensurePageLoaderSuccess} from "./Helper";
import {executeRequest} from "../request";
import {HTMLElement} from "node-html-parser";
import {
    CacheKey,
    createItemCache, ItemCache,
    ItemCacheResolver,
    ResolveOptions,
    ResolveResult,
    ResolverRole
} from "../cache/Cache";
import {extractErrorMessage} from "../../utils";
import {MemoryCacheResolver} from "../cache/CacheResolver";
import {downloadImage} from "../request/Image";

type ThatPervertPage = {
    navigator: {
        current: number | null,
        prev: number | "main" | null,
        next: number | "main" | null,
    },

    posts: FeedPost[],
};

export function downloadThatPervertImage(url: string): Promise<ImageLoadResult> {
    return downloadImage(url, {
        Referer: "http://thatpervert.com"
    });
}

class ThatPervertPageLoader implements ItemCacheResolver<number, ThatPervertPage> {
    private readonly urlBase: string;

    constructor() {
        this.urlBase = "http://thatpervert.com/tag/Masturbation+Hentai";
    }

    cached(key: CacheKey<number>): boolean { return false; }
    delete(key: CacheKey<number>): void { }
    save(key: CacheKey<number>, value: ThatPervertPage): void { }

    name(): string {
        return "ThatPervert loader";
    }

    role(): ResolverRole {
        return "resolver";
    }

    async resolve(key: CacheKey<number>, options: ResolveOptions<ThatPervertPage>): Promise<ResolveResult<ThatPervertPage>> {
        const response = await executeRequest({
            type: "GET",
            url: key.key === -1 ? this.urlBase : this.urlBase + "/" + key.key,
            urlParameters: {  },
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
                value: this.parsePage(key.key, response.payload),
            };
        } catch (error) {
            return {
                status: "cache-error",
                message: extractErrorMessage(error)
            }
        }
    }

    private parsePage(pageId: number, container: HTMLElement) : ThatPervertPage {
        let result: ThatPervertPage = {
            navigator: {
                current: pageId,
                next: null,
                prev: null
            },
            posts: []
        };

        /* extract the page count */
        {
            const pagination = container.querySelector("#Pagination");
            if(!pagination) {
                throw new Error("missing #paginator");
            }

            const prevUrl = pagination.querySelector("a.prev")?.getAttribute("href");
            if(prevUrl) {
                const urlMatch = /\/([0-9]+)$/gm.exec(prevUrl)
                if(!urlMatch || urlMatch.length < 2) {
                    result.navigator.prev = "main";
                } else {
                    result.navigator.prev = parseInt(urlMatch[1]);
                }
            }

            const nextUrl = pagination.querySelector("a.next")?.getAttribute("href");
            if(nextUrl) {
                const urlMatch = /\/([0-9]+)$/gm.exec(nextUrl)
                if(!urlMatch || urlMatch.length < 2) {
                    result.navigator.next = "main";
                } else {
                    result.navigator.next = parseInt(urlMatch[1]);
                }
            }
        }

        /* extract the post entries */
        {
            const posts = container.querySelectorAll("#post_list .postContainer");
            for(const postNode of posts) {
                const postImages: PostImage[] = [];

                let postUrl: string;
                {
                    const manageLinkNode = postNode.querySelector(".manage .link");
                    if(!manageLinkNode) {
                        console.warn("Missing .manage .link Node for post.");
                        continue;
                    }
                    postUrl = manageLinkNode.getAttribute("href")!;
                }

                for(const postImage of postNode.querySelectorAll(".post_content .image")) {
                    const previewNode = postImage.querySelector("img");
                    if(!previewNode) {
                        console.warn("Missing preview node for post image");
                        continue;
                    }

                    const anchorNode = postImage.querySelector("a");
                    if(anchorNode) {
                        const detailedUrl = anchorNode.getAttribute("href")!;
                        const previewUrl = previewNode.getAttribute("src")!;

                        postImages.push({
                            detailed: {
                                identifier: detailedUrl,
                                metadata: {},

                                width: null,
                                height: null,

                                loadImage: () => downloadThatPervertImage(detailedUrl)
                            },
                            preview: {
                                identifier: previewUrl,
                                metadata: {},

                                width: parseInt(previewNode.getAttribute("width")!),
                                height: parseInt(previewNode.getAttribute("height")!),

                                loadImage: () => downloadThatPervertImage(previewUrl)
                            },
                            other: []
                        });
                    } else {
                        /* We don't have a high res image */
                        const previewUrl = previewNode.getAttribute("src")!;
                        postImages.push({
                            detailed: {
                                identifier: previewUrl,
                                metadata: {},

                                width: parseInt(previewNode.getAttribute("width")!),
                                height: parseInt(previewNode.getAttribute("height")!),

                                loadImage: () => downloadThatPervertImage(previewUrl)
                            },
                            preview: null,
                            other: []
                        });
                    }
                }

                result.posts.push({
                    type: "image",
                    images: postImages,
                    metadata: {
                        detailedPostUrl: postUrl
                    }
                });
            }
        }

        return result;
    }
}

class ThatPervertFeedProvider implements FeedProvider {
    private static kPostsPerSite = 10;
    private pageLoader: ItemCache<number, ThatPervertPage>;

    constructor(readonly filter: FeedFilter) {
        this.pageLoader =  createItemCache<number, ThatPervertPage>(
            page => page.toString(),
            [
                new MemoryCacheResolver(),
                new ThatPervertPageLoader()
            ]
        );
    }

    randomAccessSupported(target: "page" | "entry"): boolean {
        /* page and entry are both supported */
        return true;
    }

    async getEntryCount(): Promise<number> {
        throw "not yet implemented!";
        /*
        const firstPage = await this.pageLoader.loadPage(1);
        if(firstPage.status !== "success") {
            throw "failed to load first page (" + firstPage.message + ")";
        } else if(typeof firstPage.page.navigator.max !== "number") {
            throw "first page misses page count";
        }

        const lastPage = await this.pageLoader.loadPage(firstPage.page.navigator.max);
        if(lastPage.status !== "success") {
            throw "failed to load last page (" + lastPage.message + ")";
        }

        return (firstPage.page.navigator.max - 1) * KonachenFeedProvider.kPostsPerSite + lastPage.page.posts.length;
        */
    }

    async getPageCount(): Promise<number> {
        const firstPage = await ensurePageLoaderSuccess(this.pageLoader, -1);

        const { prev, next } = firstPage.navigator;
        if(prev === null && next === null) {
            /* we only got one page */
            return 1;
        } else if(typeof next === "number") {
            return next + 1;
        } else {
            throw "TODO: search page count!"
        }
    }

    async loadEntry(target: number): Promise<FeedPost> {
        return { type: "error", errorType: "not-found" };
    }

    async loadEntryRef(target: any): Promise<FeedPost> {
        return { type: "error", errorType: "not-found" };
    }

    async loadPage(target: number): Promise<FeedPost[]> {
        //  console.error("Load page: %o/%o", target, await this.getPageCount());

        /* FIXME: Thatpervert is alignt to the front. This means that page 1 contains some items from page 2 */
        const page = await ensurePageLoaderSuccess(this.pageLoader, await this.getPageCount() - target + 1);
        return page.posts;
    }
}


export class ThatPervertBlogProvider implements BlogProvider {
    id(): string {
        return "thatpervert.com";
    }

    blogName(): string {
        return "Thatpervert";
    }

    filteredFeed(filter: FeedFilter): FeedProvider {
        return new ThatPervertFeedProvider(filter);
    }

    mainFeed(): FeedProvider {
        return new ThatPervertFeedProvider({});
    }

}
