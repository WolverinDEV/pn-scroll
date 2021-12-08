import React, {ForwardedRef, MutableRefObject, RefObject, useEffect, useRef, useState} from "react";
import {BlogProvider, SearchHint, SuggestionResult} from "../../engine";
import {ScrollView, StyleSheet, Text, TextInput, TextInputProps, View} from "react-native";
import {useObjectReducer} from "../hooks/ObjectReducer";
import {useHistory} from "react-router-native";
import {parseSearchText, SearchParseResult} from "../../engine/Search";
import {original} from "@reduxjs/toolkit";

type SearchBarState = {
    text: string,
    textCursor: number,

    parseState: SearchParseResult | null,

    suggestionsOpen: boolean,
    suggestionSelected: string | null,
    suggestionsAbortController: AbortController | null,
    suggestionsAvailable: SuggestionResult | { status: "loading" | "unset" },

    searchHintsAbort: AbortController | null,
    searchHints: SearchHint[],
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

        suggestionsAbortController: null,
        parseState: null,

        searchHintsAbort: null,
        searchHints: [],

        suggestionSelected: null,
        suggestionsAvailable: { status: "unset" },
        suggestionsOpen: false,
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

            dispatch("loadSearchHints");
            console.info("Parse result: %o", draft.parseState);
        },
        loadSearchHints: draft => {
            draft.searchHintsAbort?.abort();
            draft.searchHintsAbort = null;
            if(!draft.parseState) {
                return;
            }

            const abortController = draft.searchHintsAbort = new AbortController();
            props.blog.analyzeSearch(original(draft.parseState)!, abortController.signal).then(result => {
                if(abortController.signal.aborted) {
                    return;
                }

                dispatch("handleSearchHints", result);
            });
        },
        handleSearchHints: (draft, payload: SearchHint[]) => {
            draft.suggestionsAbortController = null;
            draft.searchHints = payload;
        },
        loadSuggestions: (draft, prefix: string | null) => {
            draft.suggestionsAbortController?.abort();
            draft.suggestionsAbortController = null;

            if(prefix?.startsWith("!")) {
                prefix = prefix?.substring(1);
            }

            if(!prefix) {
                draft.suggestionSelected = null;
                draft.suggestionsOpen = false;
                draft.suggestionsAvailable = { status: "unset" };
                return;
            }

            draft.suggestionsAvailable = { status: "loading" };
            const abortController = draft.suggestionsAbortController = new AbortController();
            props.blog.queryTagSuggestions(prefix, abortController.signal).then(result => {
                if(abortController.signal.aborted) {
                    return;
                }

                dispatch("handleSuggestions", result);
            });
        },
        handleSuggestions: (draft, payload: SuggestionResult) => {
            draft.suggestionsAbortController = null;
            draft.suggestionsAvailable = payload;

            /* Show errors and suggestions only. */
            if(payload.status === "success" && payload.suggestions.length > 0) {
                draft.suggestionsOpen = true;
            } else if(payload.status === "error") {
                draft.suggestionsOpen = true;
            }
            console.info("Suggestion for %s: %o. Visible: %o", draft.text, payload, draft.suggestionsOpen);
        },
        selectNextSuggestion: (draft, direction: number) => {
            if(draft.suggestionsAvailable.status !== "success") {
                return;
            }

            const suggestions = draft.suggestionsAvailable.suggestions;
            let index = suggestions.indexOf(draft.suggestionSelected as string) + direction;
            if(index >= suggestions.length) {
                index = suggestions.length - 1;
            }

            draft.suggestionSelected = draft.suggestionsAvailable.suggestions[index] || null;
            console.error("Select %d %s", index, draft.suggestionSelected);
        },
        submitSuggestion: draft => {
            if(!draft.suggestionSelected || !draft.parseState) {
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
                refSelection.current.start = editingValue.begin + draft.suggestionSelected.length + suggestionPrefix.length;
                refSelection.current.end = refSelection.current.start;
            }

            newText = draft.text.substring(0, editingValue.begin) + suggestionPrefix + draft.suggestionSelected + draft.text.substring(editingValue.end);

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
            state.suggestionsAbortController?.abort();
            state.searchHintsAbort?.abort();
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
                                if(state.suggestionSelected) {
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
                {state.suggestionsOpen && <SuggestionProvider key={"suggestions"} status={state.suggestionsAvailable} selectedSuggestion={state.suggestionSelected} />}
                <HintProvider hints={state.searchHints} />
            </View>
        </View>
    );
});

const HintProvider = React.memo(({ hints }: { hints: SearchHint[] }) => {
    const [hint] = hints;
    if (!hint) {
        return null;
    }

    return (
        <View style={styleHints.container}>
            <Text style={[styleHints.text, hint.type === "warning" ? styleHints.textWarning : styleHints.textError]}>{hint.message}</Text>
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
                <Text key={suggestion} style={[styleSuggestions.suggestion, suggestion === props.selectedSuggestion && styleSuggestions.suggestionSelected]}>{suggestion}</Text>
            ));
            break;

        case "unset":
        case "aborted":
        default:
            return null;
    }

    return (
        <ScrollView style={styleSuggestions.suggestionContainer}>
            {body}
        </ScrollView>
    )
});

const styleHints = StyleSheet.create({
    container: {
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,

        display: "flex",
        flexDirection: "row",
    },
    text: {
        color: "red",
        fontSize: 10,
    },
    textWarning: {
        color: "#e8c930"
    },
    textError: {
        color: "#e83030"
    }
})

const styleSuggestions = StyleSheet.create({
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

        zIndex: 10
    },
    suggestion: {
        color: "black"
    },
    suggestionSelected: {
        color: "red",
    },
});

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
});
