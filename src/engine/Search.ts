/*
 * Search syntax:
 * include-tag: <tag>
 * skip-tag: <tag>
 * <normal query>
 */

export type RefString = {
    value: string,
    begin: number,
    end: number
}

export type SearchParseResult = {
    status: "success",
    includeTags: RefString[],
    excludeTags: RefString[],
    query: RefString | null,
};

const debugSearchText = (text: string, knownTags: string[]) => {
    console.info({
        text,
        knownTags,
        result: parseSearchText(text, knownTags)
    });
}

/* tag:bondage Rope { knownTags: [] } -> tag: [bondage] query: Rope */
/* tag:home porn Nova { knownTags: [home porn] } -> tag:[home porn] query: Nova */
/* tag:home porn Nova { knownTags: [] } -> tag:[home] query: porn Nova */
/* tag:home porn tag:test Nova { knownTags: [] } -> tag:[home porn, test] query: Nova */
debugSearchText("tag:bondage Rope", []);
debugSearchText("tag:home porn Nova", ["home porn"]);
debugSearchText("tag:home porn Nova", []);
debugSearchText("tag:home porn tag:test Nova", []);

export function parseSearchText(text: string, knownTags: string[]): SearchParseResult {
    const keyMap: {
        [key: string] : (key: RefString, value: RefString, closed: boolean) => number | void,
    } = {};

    const includeTags: RefString[] = [];
    const excludeTags: RefString[] = [];
    let query: RefString | null = null;

    keyMap["tag"] = (key, value, closed) => {
        const exclude = key.value === "tag-exclude" || key.value === "!tag";

        const parts = value.value.split(" ");
        if(closed || parts.length === 1) {
            /* it's pretty simple since we know the boundaries */
            (exclude ? excludeTags : includeTags).push(value);
            return;
        }

        let tag = "";
        let verifiedTag: string | null = null;
        for(const part of parts) {
            if(tag.length === 0) {
                tag = part;
            } else {
                tag += " " + part;
            }

            let lowerTag = tag.toLowerCase();
            for(const knownTag of knownTags) {
                if(knownTag.toLowerCase().startsWith(lowerTag)) {
                    verifiedTag = tag;
                    break;
                }
            }
        }

        if(!verifiedTag) {
            /* We have to guess that only the first word is the tag. */
            verifiedTag = parts[0];
        }

        (exclude ? excludeTags : includeTags).push({
            begin: value.begin,
            end: value.begin + verifiedTag.length,
            value: verifiedTag
        });

        /* process everything after the space of the known tag */
        return verifiedTag.length + 1;
    }
    keyMap["tag-include"] = keyMap["tag"];

    keyMap["!tag"] = keyMap["tag"];
    keyMap["tag-exclude"] = keyMap["tag"];

    let textOffset = 0;
    outerLoop:
        while(text.length) {
            for(const keyWord of Object.keys(keyMap)) {
                if(text.startsWith(keyWord + ":")) {
                    const key: RefString = {
                        begin: textOffset,
                        end: textOffset + keyWord.length,
                        value: keyWord
                    };
                    textOffset += keyWord.length + 1;

                    const value: RefString = {
                        begin: textOffset,
                        end: -1,
                        value: text.substring(keyWord.length + 1)
                    };

                    for(const keyWord of Object.keys(keyMap)) {
                        const index = value.value.indexOf(" " + keyWord + ":");
                        if(index === -1) {
                            continue;
                        }

                        if(value.end === -1 || value.end > index) {
                            value.end = index;
                        }
                    }

                    const closed = value.end !== -1;
                    if(closed) {
                        /* we will have a leading space */
                        text = value.value.substring(value.end + 1);
                        textOffset += value.end + 1;

                        value.value = value.value.substring(0, value.end);
                    } else {
                        value.end = textOffset + value.value.length;
                        textOffset = value.end;
                        text = "";
                    }


                    const unusedIndex = keyMap[keyWord](key, value, closed);
                    if(typeof unusedIndex === "number" && unusedIndex >= 0) {
                        const unusedText = value.value.substring(unusedIndex);
                        text = unusedText + text;
                        textOffset -= unusedText.length;
                    }

                    continue outerLoop;
                }
            }

            query = {
                begin: textOffset,
                end: text.length + textOffset,
                value: text
            }
            break;
        }

    return {
        status: "success",
        includeTags,
        excludeTags,
        query
    };
}
