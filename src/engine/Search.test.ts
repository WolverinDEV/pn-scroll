import { parseSearchText, SearchParseResult } from "./Search";

test("parse empty", () => {
    expect(
        parseSearchText("", [])
    ).toEqual({
        status: "success",
        excludeTags: [],
        includeTags: [],
        query: null
    });


    expect(
        parseSearchText(" ", [])
    ).toEqual({
        status: "success",
        excludeTags: [],
        includeTags: [],
        query: { value: " ", begin: 0, end: 1 }
    });
});

test("tag parse", () => {
    const parseResult: SearchParseResult = {
        status: "success",
        excludeTags: [],
        includeTags: [{ value: "bondage", begin: 4, end: 11 }],
        query: { value: "Rope", begin: 12, end: 16 }
    };

    expect(
        parseSearchText("tag:bondage Rope", [])
    ).toEqual(parseResult);


    expect(
        parseSearchText("TaG:bondage Rope", [])
    ).toEqual(parseResult);
});

test("tag parse with space", () => {
    const parseResult: SearchParseResult = {
        status: "success",
        excludeTags: [],
        includeTags: [{ value: "bondage Rope", begin: 4, end: 16 }],
        query: null
    };

    expect(
        parseSearchText("tag:bondage Rope", [ "bondage Rope" ])
    ).toEqual(parseResult);

    expect(
        parseSearchText("tag:bondage Rope", [ "bondage roPe" ])
    ).toEqual(parseResult);
});

test("tag + space + tag", () => {
    const parseResult: SearchParseResult = {
        status: "success",
        excludeTags: [],
        includeTags: [
            { value: "bondage Rope", begin: 4, end: 16 },
            { value: "test", begin: 21, end: 25 },
        ],
        query: null
    };

    expect(
        parseSearchText("tag:bondage Rope tag:test", [])
    ).toEqual(parseResult);
});

test("tag + space + tag + space", () => {
    const parseResult: SearchParseResult = {
        status: "success",
        excludeTags: [],
        includeTags: [
            { value: "bondage Rope", begin: 4, end: 16 },
            { value: "test me", begin: 21, end: 28 },
        ],
        query: null
    };

    expect(
        parseSearchText("tag:bondage Rope tag:test me", ["test me"])
    ).toEqual(parseResult);
});

test("tag + space + tag + space query", () => {
    const parseResult: SearchParseResult = {
        status: "success",
        excludeTags: [],
        includeTags: [
            { value: "bondage Rope", begin: 4, end: 16 },
            { value: "test", begin: 21, end: 25 },
        ],
        query: { value: "me", begin: 26, end: 28 }
    };

    expect(
        parseSearchText("tag:bondage Rope tag:test me", [])
    ).toEqual(parseResult);
});
