import React, {ForwardedRef, MutableRefObject, RefObject, useEffect, useRef, useState} from "react";
import {BlogProvider, SuggestionResult} from "../../engine";
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    View
} from "react-native";
import {useObjectReducer} from "../hooks/ObjectReducer";
import {useHistory} from "react-router-native";

/*
 * Search syntax:
 * include-tag: <tag>
 * skip-tag: <tag>
 * <normal query>
 */

type RefString = {
    value: string,
    begin: number,
    end: number
}

type SearchParseResult = {
    status: "success",
    includeTags: RefString[],
    excludeTags: RefString[],
    query: RefString | null,
};

type SearchBarState = {
    text: string,
    textCursor: number,

    abortController: AbortController | null,

    parseState: SearchParseResult | null,

    currentSuggestion: string | null,
    currentSuggestions: SuggestionResult | { status: "loading" | "unset" },

    lastSuggestions: string[] | null,
}

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

type SelectionState = {
    start: number | null,
    end: number | null
};

const kInitialSelectionState: SelectionState = {
    start: null,
    end: null
};

const CursorFixTextInput = React.forwardRef((
    props: TextInputProps & { refCursor?: MutableRefObject<SelectionState> },
    refInput: ForwardedRef<TextInput>
) => {
    if(typeof refInput === "function") {
        console.warn("CursorFixTextInput needs a MutableRefObject as reference to work!");
        return <TextInput key={"invalid-ref"} {...props} />;
    }

    if(!("HTMLInputElement" in self)) {
        return <TextInput key={"no-web"} {...props} />;
    }

    const defaultRefCursor = useRef<SelectionState>(kInitialSelectionState);
    const defaultRefObject = useRef<TextInput>(null);

    const { value, onChange, ...restProps } = props;
    const refObject: RefObject<TextInput> = refInput || defaultRefObject;
    const refCursor = props.refCursor || defaultRefCursor;

    const [ selectionTimestamp, setSelectionTimestamp ] = useState<number>(0);

    useEffect(() => {
        if(!refCursor.current) {
            return;
        }

        if(refObject.current instanceof HTMLInputElement) {
            refObject.current.setSelectionRange(refCursor.current.start, refCursor.current.end);
        }
    }, [ refObject, selectionTimestamp, value ]);

    return (
        <TextInput
            key={"fixup"}
            ref={refObject}
            value={value}
            onChange={event => {
                const eventTarget = event.target as any;
                if(eventTarget instanceof HTMLInputElement) {
                    refCursor.current = {
                        start: eventTarget.selectionStart,
                        end: eventTarget.selectionEnd
                    };

                    setSelectionTimestamp(performance.now());
                }

                if(onChange) {
                    onChange(event);
                }
            }}
            {...restProps}
        />
    )
});

export const SearchBar = React.memo((props: { blog: BlogProvider, blogName: string, initialQuery?: string }) => {
    const navigate = useHistory();
    //const { id: blogName, parameter: encodedParameters } = useParams<{ id: string, parameter: string | undefined }>();

    const [ state, dispatch ] = useObjectReducer<SearchBarState>({
        text: "",
        textCursor: 0,

        abortController: null,
        parseState: null,

        currentSuggestion: null,
        currentSuggestions: { status: "unset" },
        lastSuggestions: null
    }, { immer: true })({
        setText: (draft, { text, cursor, showSuggestions }: { text: string, cursor: number, showSuggestions: boolean }) => {
            if(draft.text === text) {
                return;
            }

            console.info("Text: %s, Cursor: %d", text, cursor);
            draft.text = text;
            draft.textCursor = cursor;
            draft.parseState = parseSearchText(text, ["home porn"]);


            if(showSuggestions) {
                let editingValue: string | null = null;
                for(const tag of [...draft.parseState.includeTags, ...draft.parseState.excludeTags]) {
                    if(tag.begin <= cursor && cursor <= tag.end) {
                        /* Add +1 because that's the character we just added */
                        editingValue = tag.value.substring(0, cursor - tag.begin + 1);
                        console.info("Write in tag %s (%s)", tag.value, editingValue);
                        break;
                    }
                }

                if(!editingValue && draft.parseState.query) {
                    const query = draft.parseState.query;
                    if(query.begin <= draft.textCursor && draft.textCursor <= query.end) {
                        editingValue = query.value.substring(0, cursor - query.begin + 1);
                    }
                }

                dispatch("loadSuggestions", editingValue);
            }

            console.info("Parse result: %o", draft.parseState);
        },
        loadSuggestions: (draft, prefix: string | null) => {
            draft.abortController?.abort();
            draft.abortController = null;

            if(prefix?.startsWith("!")) {
                prefix = prefix?.substring(1);
            }

            if(!prefix) {
                draft.lastSuggestions = null;
                draft.currentSuggestion = null;
                draft.currentSuggestions = { status: "unset" };
                return;
            }

            if(draft.currentSuggestions.status === "success") {
                draft.lastSuggestions = draft.currentSuggestions.suggestions;
            }

            draft.currentSuggestions = { status: "loading" };
            const abortController = draft.abortController = new AbortController();
            props.blog.queryTagSuggestions(prefix, abortController.signal).then(result => {
                if(abortController.signal.aborted) {
                    return;
                }

                dispatch("handleSuggestions", result);
            });
        },
        handleSuggestions: (draft, payload: SuggestionResult) => {
            draft.abortController = null;
            draft.currentSuggestions = payload;

            console.info("Suggestion for %s: %o", draft.text, payload);
        },
        selectNextSuggestion: (draft, direction: number) => {
            if(draft.currentSuggestions.status !== "success") {
                return;
            }

            const suggestions = draft.currentSuggestions.suggestions;
            let index = suggestions.indexOf(draft.currentSuggestion as string) + direction;
            if(index >= suggestions.length) {
                index = suggestions.length - 1;
            }

            draft.currentSuggestion = draft.currentSuggestions.suggestions[index] || null;
            console.error("Select %d %s", index, draft.currentSuggestion);
        },
        submitSuggestion: draft => {
            if(!draft.currentSuggestion || !draft.parseState) {
                return;
            }

            let editingValue = null;
            let suggestionPrefix = "";
            for(const tag of [...draft.parseState.includeTags, ...draft.parseState.excludeTags]) {
                if(tag.begin <= draft.textCursor && draft.textCursor <= tag.end) {
                    editingValue = tag;
                    break;
                }
            }

            if(!editingValue && draft.parseState.query) {
                const query = draft.parseState.query;
                if(query.begin <= draft.textCursor && draft.textCursor <= query.end) {
                    editingValue = query;

                    if(editingValue.value.startsWith("!")) {
                        /* negative tag */
                        editingValue.value = editingValue.value.substring(1);
                        suggestionPrefix = "!tag:";
                    } else {
                        suggestionPrefix = "tag:";
                    }
                }
            }

            if(!editingValue) {
                console.warn("failed to add suggestion since we have no value which we edit.");
                return;
            }

            let newText: string;
            if(refSelection.current) {
                /* fixup selection */
                refSelection.current.start = editingValue.begin + draft.currentSuggestion.length + suggestionPrefix.length;
                refSelection.current.end = refSelection.current.start;
            }

            newText = draft.text.substring(0, editingValue.begin) + suggestionPrefix + draft.currentSuggestion + draft.text.substring(editingValue.end);

            dispatch("setText", { text: newText, cursor: refSelection.current?.start || 0, showSuggestions: false });
            dispatch("loadSuggestions", null);
        },
        submit: draft => {
            if(draft.parseState?.status !== "success") {
                return;
            }

            if(draft.text) {
                navigate.push(`/feed/${props.blogName}/query/${draft.text}`);
            }
        }
    });

    useEffect(() => {
        if(props.initialQuery) {
            dispatch("setText", { text: props.initialQuery, cursor: props.initialQuery.length, showSuggestions: false });
        }
        return () => {
            state.abortController?.abort();
            /* No need for further cleanup since we're never using the state again. */
        }
    }, []);

    const refSelection = useRef<SelectionState>(kInitialSelectionState);

    return (
        <View style={style.container}>
            <View style={style.innerContainer}>
                <CursorFixTextInput
                    refCursor={refSelection}

                    style={style.input}
                    placeholder={"Search tags"}
                    value={state.text}
                    onBlur={() => dispatch("loadSuggestions", null)}
                    onChange={event => dispatch("setText", {
                        text: event.nativeEvent.text,
                        cursor: refSelection.current.start || 0,
                        showSuggestions: true
                    })}
                    onKeyPress={event => {
                        switch(event.nativeEvent.key) {
                            case "ArrowUp":
                                event.preventDefault();
                                dispatch("selectNextSuggestion", -1);
                                break;

                            case "ArrowDown":
                                event.preventDefault();
                                dispatch("selectNextSuggestion", 1);
                                break;

                            case "Tab":
                                if(state.currentSuggestion) {
                                    event.preventDefault();
                                }

                                dispatch("submitSuggestion");
                                break;

                            case "Enter":
                                dispatch("submit");
                                break;
                        }
                    }}
                />
                <SuggestionProvider status={state.currentSuggestions} selectedSuggestion={state.currentSuggestion} />
            </View>
        </View>
    );
});

const SuggestionProvider = React.memo((props: { status: SuggestionResult | { status: "loading" | "unset" }, selectedSuggestion: string | null, }) => {
    let body;
    switch (props.status.status) {
        case "loading":
            body = (
                <View key={"loading"}>
                    <Text>loading...</Text>
                </View>
            );
            break;

        case "error":
            body = (
                <View key={"error"}>
                    <Text>Error: {props.status.message}</Text>
                </View>
            );
            break;

        case "success":
            if(!props.status.suggestions.length) {
                return null;
            }

            body = props.status.suggestions.map(suggestion => (
                <Text key={suggestion} style={[style.suggestion, suggestion === props.selectedSuggestion && style.suggestionSelected]}>{suggestion}</Text>
            ));
            break;

        case "unset":
        case "aborted":
        default:
            return null;
    }

    return (
        <ScrollView style={style.suggestionContainer}>
            {body}
        </ScrollView>
    )
})

const style = StyleSheet.create({
    container: {
        zIndex: 10,
        overflow: "visible",
        alignSelf: "center",
        paddingLeft: 20,
        paddingRight: 20,
        flex: 1,
    },
    innerContainer: {
        position: "relative",
    },
    input: {

        borderWidth: 1.5,
        borderColor: "#333",
        borderRadius: 2,

        paddingLeft: 5,
        paddingRight: 5,
        paddingTop: 2,
        paddingBottom: 2,

        color: "white",

        padding: 6
    },

    suggestionContainer: {
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,

        display: "flex",
        flexDirection: "column",

        backgroundColor: "#fff",
        padding: 5,

        minHeight: 100,
        maxHeight: 400,
    },

    suggestion: {
        color: "black"
    },
    suggestionSelected: {
        color: "red",
    }
});
