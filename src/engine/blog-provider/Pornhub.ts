import {BlogProvider, FeedEntry, FeedFilter, FeedProvider, SearchHint, SuggestionResult} from "../index";
import {SearchParseResult} from "../Search";
import {downloadImage} from "../request/Image";
import { ImageInfo, ImageLoadResult } from "../types/PostImage";

class PornhubFeedProvider implements FeedProvider {
    async getPageCount(): Promise<number> {
        return 1;
    }

    async loadPage(target: number): Promise<FeedEntry[]> {
        if(target > 1) {
            throw "invalid target";
        }

        return [
            {
                type: "ph-video",
                id: "ph60192e1696c77",
                viewKey: "ph60192e1696c77"
            },

            {
                type: "ph-video",
                id: "ph60192e1696c77",
                viewKey: "ph60192e1696c77"
            },

            {
                type: "ph-video",
                id: "ph60192e1696c77",
                viewKey: "ph60192e1696c77"
            }
        ];
    }
}

export class PornhubBlogProvider implements BlogProvider {
    blogName(): string {
        return "PornHub";
    }

    mainFeed(): FeedProvider {
        return new PornhubFeedProvider();
    }

    filteredFeed(filter: FeedFilter): FeedProvider {
        return new PornhubFeedProvider();
    }

    loadImage(image: ImageInfo): Promise<ImageLoadResult> {
        return downloadImage(image.identifier, { });
    }

    async queryTagSuggestions(text: string, abortSignal: AbortSignal): Promise<SuggestionResult> {
        return { status: "error", message: "not implemented" };
    }

    async analyzeSearch(search: SearchParseResult, abortSignal: AbortSignal): Promise<SearchHint[]> {
        return [];
    }
}
