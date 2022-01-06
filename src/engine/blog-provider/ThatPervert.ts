import {
    BlogProvider,
    FeedFilter,
    FeedEntry,
    FeedProvider,
    PostImage, SuggestionResult, SearchHint,
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
import "./ThatPervertTagGenerator";
import {SearchParseResult} from "../Search";
const knownTags = import("./ThatPervertTags.json");
knownTags.then(result => {
    console.info("Known tags: %o", result.length);
});

type ThatPervertPage = {
    navigator: {
        current: number | null,
        prev: number | "main" | null,
        next: number | "main" | null,
    },

    posts: FeedEntry[],
};

class ThatPervertPageLoader implements ItemCacheResolver<number, ThatPervertPage> {
    private readonly urlBase: string;

    constructor() {
        this.urlBase = "http://thatpervert.com/tag/Masturbation+Hentai";
        //this.urlBase = "http://thatpervert.com/";
    }

    async cached(key: CacheKey<number>): Promise<boolean> { return false; }
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
                            },
                            preview: {
                                identifier: previewUrl,
                                metadata: {},

                                width: parseInt(previewNode.getAttribute("width")!),
                                height: parseInt(previewNode.getAttribute("height")!),
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
                            },
                            preview: null,
                            other: []
                        });
                    }
                }

                result.posts.push({
                    type: "image",
                    id: postUrl,
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
    private readonly pageLoader: ItemCache<number, ThatPervertPage>;

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

    async loadPage(target: number): Promise<FeedEntry[]> {
        const pageCount = await this.getPageCount();
        /* FIXME: ThatPervert aligns to the front or back depending if we're searching or browsing. */
        const page = await ensurePageLoaderSuccess(this.pageLoader, pageCount - target + 1);
        return page.posts;
    }
}


export class ThatPervertBlogProvider implements BlogProvider {
    blogName(): string {
        return "Thatpervert";
    }

    filteredFeed(filter: FeedFilter): FeedProvider {
        return new ThatPervertFeedProvider(filter);
    }

    mainFeed(): FeedProvider {
        return new ThatPervertFeedProvider({});
    }

    async queryTagSuggestions(text: string, abortSignal: AbortSignal): Promise<SuggestionResult> {
        return { status: "error", message: "not implemented" };
    }

    async analyzeSearch(search: SearchParseResult, abortSignal: AbortSignal): Promise<SearchHint[]> {
        const hints: SearchHint[] = [];

        if(search.query && search.query.value.length > 0) {
            if(search.includeTags.length > 0) {
                hints.push({
                    type: "warning",
                    message: "Combining search text with tags is not recommended and leads to truncated results."
                });
            }
        }

        return hints;
    }

    loadImage(image: PostImage.ImageInfo): Promise<PostImage.ImageLoadResult> {
        return downloadImage(image.identifier, {
            Referer: "http://thatpervert.com"
        });
    }
}
