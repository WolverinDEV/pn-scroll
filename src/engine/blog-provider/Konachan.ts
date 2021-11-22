import {
    BlogProvider,
    FeedPost,
    FeedFilter,
    FeedProvider,
    PostImageInfo,
    PostImageLoaded,
    PostImageLoadError
} from "../index";
import {executeRequest} from "../request";
import {CachedPageLoader} from "./Helper";
import {ImageCache} from "../cache/Image";

type KonachenPage = {
    navigator: {
        current: number | null,
        max: number | null,
    },

    posts: FeedPost[],
};

class KonachenImageCache extends ImageCache {
    constructor() {
        super();
    }
    
    protected async doLoadImage(imageUrl: string): Promise<PostImageLoaded | PostImageLoadError> {
        const result = await executeRequest({
            type: "GET",
            responseType: "binary",
            url: imageUrl,
            headers: { }
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

const imageCache = new KonachenImageCache();
class KonachenPageLoader extends CachedPageLoader<KonachenPage> {
    constructor(readonly url: string) {
        super();
    }

    protected async doLoadPage(target: number): Promise<KonachenPage> {
        const response = await executeRequest({
            type: "GET",
            url: `https://${this.url}/post`,
            urlParameters: {
                tags: "bondage",
                page: target
            },
            responseType: "html"
        });

        if(response.status !== "success") {
            throw response.statusText + " (" + response.payload + ")";
        }

        return this.parsePage(response.payload);
    }

    private parsePage(element: Document) : KonachenPage {
        let result: KonachenPage = {
            navigator: {
                current: null,
                max: null
            },
            posts: []
        };

        let container = element.body;

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
                        width: parseInt(thumbnailImageNode.getAttribute("width") || ""),
                        height: parseInt(thumbnailImageNode.getAttribute("height") || ""),
                        url: thumbnailImageNode.getAttribute("src")!,
                        loadImage: () => imageCache.loadImage(imageUrl)
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
                        width: width,
                        height: height,
                        url: imageUrl,
                        loadImage: () => imageCache.loadImage(imageUrl)
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
}

class KonachenFeedProvider implements FeedProvider {
    private static kPostsPerSite = 18;
    private pageLoader: KonachenPageLoader;

    constructor(readonly url: string, readonly filter: FeedFilter) {
        this.pageLoader = new KonachenPageLoader(url);
    }

    randomAccessSupported(target: "page" | "entry"): boolean {
        /* page and entry are both supported */
        return true;
    }

    async getEntryCount(): Promise<number> {
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
    }

    async getPageCount(): Promise<number> {
        const firstPage = await this.pageLoader.loadPage(1);
        if(firstPage.status !== "success") {
            throw "failed to load first page (" + firstPage.message + ")";
        } else if(typeof firstPage.page.navigator.max !== "number") {
            throw "first page misses page count";
        }

        return firstPage.page.navigator.max;
    }

    async loadEntry(target: number): Promise<FeedPost> {
        return { type: "error", errorType: "not-found" };
    }

    async loadEntryRef(target: any): Promise<FeedPost> {
        return { type: "error", errorType: "not-found" };
    }

    async loadPage(target: number): Promise<FeedPost[]> {
        const page = await this.pageLoader.loadPage(target);
        if(page.status === "success") {
            return page.page.posts;
        } else {
            throw "failed to load page (" + page.message + ")";
        }
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