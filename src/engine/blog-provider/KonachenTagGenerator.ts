import {executeRequest} from "../request";

/*
 * Utils for fetching all Konachan tags.
 *
 * KonachanTags.json has been generated on the 01.12.2021.
 * Ran for about 15min.
 */

const fetchTags = async () => {
    //https://konachan.net/tag?name=&order=count&page=2&type=
    let page = 1;

    const tags: any[] = [];
    while(true) {
        if(page % 10 === 1) {
            console.info("Query page %d (Tag count %d)", page, tags.length);
        } else {
            console.debug("Query page %d (Tag count %d)", page, tags.length);
        }

        const response = await executeRequest({
            type: "GET",
            url: "https://konachan.net/tag",
            urlParameters: {
                name: "",
                order: "count",
                page: page,
                type: ""
            },
            responseType: "html"
        });

        if(response.status !== "success") {
            console.error("Failed to query: %o", response);
            break;
        }

        const contentTag = response.payload.querySelector("#content > table");
        if(!contentTag) {
            console.error("Missing content node");
            break;
        }

        let tagCount = 0;
        for(const trNode of contentTag.querySelectorAll("tbody tr")) {
            const [ posts, name, type ] = trNode.querySelectorAll("td").map(node => node.textContent.replace(/\n/g, "").replace(/ +/g, " ").trim());
            const postCount = parseInt(posts);
            tags.push({
                postCount,
                name,
                type
            });
            tagCount++;
        }

        if(tagCount === 0) {
            console.info("End reached");
            break;
        }

        page++;
    }

    console.info("Tags: %s", JSON.stringify(tags));
};

if("window" in self) {
    (window as any).Konachan = {
        fetchTags
    };
}
