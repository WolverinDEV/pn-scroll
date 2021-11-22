import {
    BlogProvider,
    FeedFilter,
    FeedPost,
    FeedProvider,
    PostImage,
    PostImageLoaded,
    PostImageLoadError
} from "../index";
import {CachedPageLoader} from "./Helper";
import {executeRequest} from "../request";
import {ImageCache} from "../cache/Image";

/* post_list */

type ThatPervertPage = {
    navigator: {
        current: number | null,
        prev: number | "main" | null,
        next: number | "main" | null,
    },

    posts: FeedPost[],
};

class ThatPervertImageCache extends ImageCache {
    constructor() {
        super();
    }

    protected async doLoadImage(imageUrl: string): Promise<PostImageLoaded | PostImageLoadError> {
        const result = await executeRequest({
            type: "GET",
            responseType: "binary",
            url: imageUrl,
            headers: {
                Referer: "http://thatpervert.com/"
            }
        });

        if(result.status !== "success") {
            return { status: "error", message: `${result.statusCode}: ${result.payload}` };
        }

        if(result.headers["content-type"].indexOf("image") !== -1) {
            const data = new Blob([ result.payload ], { type: result.headers["content-type"] });
            const url = URL.createObjectURL(data);

            return {
                status: "loaded",
                uri: url
            };
        }

        console.error("HTML Result: %o", result);
        return { status: "error", message: "html result" };
    }
}

const imageCache = new ThatPervertImageCache();
class ThatPervertPageLoader extends CachedPageLoader<ThatPervertPage> {
    private readonly urlBase: string;

    constructor() {
        super();

        this.urlBase = "http://thatpervert.com/tag/Masturbation+Hentai";
    }

    protected async doLoadPage(target: number): Promise<ThatPervertPage> {
        const response = await executeRequest({
            type: "GET",
            url: target === -1 ? this.urlBase : this.urlBase + "/" + target,
            urlParameters: {  },
            responseType: "html"
        });

        if(response.status !== "success") {
            throw response.statusText + " (" + response.payload + ")";
        }

        return this.parsePage(target, response.payload);
    }

    private parsePage(pageId: number, element: Document) : ThatPervertPage {
        let result: ThatPervertPage = {
            navigator: {
                current: pageId,
                next: null,
                prev: null
            },
            posts: []
        };

        let container = element.body;

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
                                width: null,
                                height: null,
                                url: detailedUrl,
                                loadImage: () => imageCache.loadImage(detailedUrl)
                            },
                            preview: {
                                width: parseInt(previewNode.getAttribute("width")!),
                                height: parseInt(previewNode.getAttribute("height")!),
                                url: previewUrl,
                                loadImage: () => imageCache.loadImage(previewUrl)
                            },
                            other: []
                        });
                    } else {
                        /* We don't have a high res image */
                        const previewUrl = previewNode.getAttribute("src")!;
                        postImages.push({
                            detailed: {
                                width: parseInt(previewNode.getAttribute("width")!),
                                height: parseInt(previewNode.getAttribute("height")!),
                                url: previewUrl,
                                loadImage: () => imageCache.loadImage(previewUrl)
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
    private pageLoader: ThatPervertPageLoader;

    constructor(readonly filter: FeedFilter) {
        this.pageLoader = new ThatPervertPageLoader();
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
        const firstPage = await this.pageLoader.loadPage(-1);
        if(firstPage.status !== "success") {
            throw "failed to load first page (" + firstPage.message + ")";
        }

        const { prev, next } = firstPage.page.navigator;
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
        console.error("Load page: %o/%o", target, await this.getPageCount());

        /* FIXME: Thatpervert is alignt to the front. This means that page 1 contains some items from page 2 */
        const page = await this.pageLoader.loadPage(await this.getPageCount() - target + 1);
        if(page.status === "success") {
            return page.page.posts;
        } else {
            throw "failed to load page (" + page.message + ")";
        }
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