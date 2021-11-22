import {extractErrorMessage} from "../../utils";

export type CachedPageSuccess<T> = {
    status: "success",
    page: T
};

export type CachedPageError = {
    status: "error",
    message: string
};

export type CachedPageLoading = {
    status: "loading",
    callbacks: (() => void)[]
};

export abstract class CachedPageLoader<T> {
    private pageCache: (CachedPageSuccess<T> | CachedPageError | CachedPageLoading)[] = [];

    public async loadPage(target: number) : Promise<CachedPageSuccess<T> | CachedPageError> {
        if(typeof this.pageCache[target] !== "undefined") {
            const entry = this.pageCache[target];
            if(entry.status === "loading") {
                await new Promise<void>(resolve => entry.callbacks.push(resolve));
                return this.loadPage(target);
            }

            return entry;
        }

        const loadingEntry: CachedPageLoading = this.pageCache[target] = {
            status: "loading",
            callbacks: []
        };

        try {
            this.pageCache[target] = {
                status: "success",
                page: await this.doLoadPage(target)
            };
        } catch (error) {
            console.error(error);
            this.pageCache[target] = {
                status: "error",
                message: extractErrorMessage(error)
            };
        }

        for(const callback of loadingEntry.callbacks) {
            callback();
        }
        return this.loadPage(target);
    }

    /**
     * Load the target page.
     * If an error occurred just throw them as an `Error`.
     * @protected
     */
    protected abstract doLoadPage(target: number) : Promise<T>;
}