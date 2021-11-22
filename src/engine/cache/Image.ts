import {PostImageLoaded, PostImageLoadError} from "../index";

type ImageCacheEntry = ImageCacheEntryLoading | {
    status: "loaded",
    result: PostImageLoaded | PostImageLoadError
};

type ImageCacheEntryLoading = {
    status: "loading",
    callbacks: (() => void)[]
};


export abstract class ImageCache {
    private cachedEntries: { [key: string]: ImageCacheEntry } = {};

    protected constructor() { }

    async loadImage(url: string) : Promise<PostImageLoaded | PostImageLoadError> {
        if(this.cachedEntries[url]) {
            const entry = this.cachedEntries[url];
            if(entry.status === "loading") {
                await new Promise<void>(resolve => entry.callbacks.push(resolve));
                return this.loadImage(url);
            }

            return entry.result;
        }

        const loading: ImageCacheEntryLoading = this.cachedEntries[url] = {
            status: "loading",
            callbacks: []
        };

        const result = this.cachedEntries[url] = {
            status: "loaded",
            result: await this.doLoadImage(url)
        };
        loading.callbacks.forEach(callback => callback());
        return result.result;
    }

    protected abstract doLoadImage(url: string) : Promise<PostImageLoaded | PostImageLoadError>;
}