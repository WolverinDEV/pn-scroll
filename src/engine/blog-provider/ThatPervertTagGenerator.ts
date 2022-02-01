import { executeRequest } from "../request";
import { asyncIDBIterator, promisifyIDBRequest } from "./Helper";

/*
 * Utils for fetching all ThatPervert tags.
 * Need to be executed within the browser.
 *
 * ThatPervertTags.json has been generated on the 01.12.2021.
 * Ran for about 4hrs.
 */

const kPromiseIgnoreConstraintError = (error: unknown) => {
    if (error instanceof DOMException && error.name === "ConstraintError") {
        return;
    } else {
        throw error;
    }
};

/* We're missing all unicode tags like \u00a0 but tbh idc */
const generateTags = (prefix: string) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ ".split("").map(tag => prefix + tag);

const openDatabase = async () => {
    const databaseRequest = indexedDB.open("ThatPervert-Tags", 1);
    databaseRequest.onupgradeneeded = ev => {
        const database = databaseRequest.result;
        let objectStore: IDBObjectStore;
        switch (ev.oldVersion) {
            case 0:
                objectStore = database.createObjectStore("tags", { keyPath: "tag" });
                objectStore = database.createObjectStore("failed", { keyPath: "prefix" });
                objectStore = database.createObjectStore("backlog", { keyPath: "prefix" });
                for (const prefix of generateTags("")) {
                    objectStore.add({ prefix });
                }
        }
    };

    return await promisifyIDBRequest(databaseRequest);
}

export const fetchTags = async () => {
    const database = await openDatabase();
    let transaction;
    let tagStore, backlogStore, failedStore;

    while (true) {
        transaction = database.transaction([ "backlog" ], "readwrite");
        backlogStore = transaction.objectStore("backlog");

        const backlogEntry = await promisifyIDBRequest(backlogStore.openCursor());
        if (!backlogEntry) {
            console.log("Backlog empty");
            break;
        }

        await promisifyIDBRequest(backlogEntry.delete());
        const tagPrefix = backlogEntry.value.prefix;
        let backlogLength = await promisifyIDBRequest(backlogStore.count());
        console.error("Execute query \"%s\" (%d queries left)", tagPrefix, backlogLength);

        const result = await executeRequest({
            type: "GET",
            url: "http://thatpervert.com/autocomplete/tag",
            urlParameters: { term: tagPrefix },
            responseType: "json"
        });
        if (result.status !== "success") {
            transaction = database.transaction([ "failed" ], "readwrite");
            failedStore = transaction.objectStore("failed");
            await promisifyIDBRequest(failedStore.add({
                prefix: tagPrefix,
                result: result
            }));

            console.error("Failed to resolve %s: %o", tagPrefix, result);
            continue;
        }

        if (!Array.isArray(result.payload)) {
            transaction = database.transaction([ "failed" ], "readwrite");
            failedStore = transaction.objectStore("failed");
            await promisifyIDBRequest(failedStore.add({
                prefix: tagPrefix,
                result: result
            }));

            console.warn("Invalid tag autocomplete result: %o", result.payload);
            continue;
        }

        const promises = [];
        if (result.payload.length === 11) {
            console.info("Tag prefix %s resulted in %d suggestions. Adding tag prefix to deeper search.", tagPrefix, result.payload.length);

            for (const tag of generateTags(tagPrefix)) {
                transaction = database.transaction([ "backlog" ], "readwrite");
                backlogStore = transaction.objectStore("backlog");
                promises.push(promisifyIDBRequest(backlogStore.add({ prefix: tag })).catch(kPromiseIgnoreConstraintError));
            }
        } else {
            console.info("Tag prefix %s resulted in %d suggestions.", tagPrefix, result.payload.length);
        }

        for (const tag of result.payload) {
            transaction = database.transaction([ "tags" ], "readwrite");
            tagStore = transaction.objectStore("tags");
            promises.push(promisifyIDBRequest(tagStore.add({
                tag,
                discovered: tagPrefix
            })).catch(kPromiseIgnoreConstraintError));
        }
        await Promise.all(promises);
    }
};

export async function processTags() {
    const database = await openDatabase();
    const transaction = database.transaction([ "tags" ], "readonly");
    const tagStore = transaction.objectStore("tags");

    const tags = [];
    for await(const { value } of asyncIDBIterator(tagStore.openCursor())) {
        tags.push(value);
    }

    console.info("All tags: %d", tags.length);
    console.info("First level tags:\n%s", tags.filter(tag => tag.discovered.length === 1).map(tag => tag.tag).join("\n"));
    console.info("BDSM: %s", tags.filter(tag => tag.tag.startsWith("bdsm")).map(tag => tag.tag).join("\n"));
    console.info("JSON: %s", JSON.stringify(tags))
}

if ("window" in self) {
    (window as any).ThatPervert = {
        processTags,
        fetchTags
    };
}
