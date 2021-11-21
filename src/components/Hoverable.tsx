import React, {useState} from "react";
import {Animated, ViewProps} from "react-native";

export const Hoverable = (props: {
    children?: React.ReactChild | ((hovered: boolean) => React.ReactChild),
    onHoverIn?: () => void,
    onHoverOut?: () => void,
}) => {
    const [ hovered, setHovered ] = useState(false);
    const [ showHovered, setShowHovered ] = useState(true);

    const child: any =
        typeof props.children === "function"
            ? props.children(showHovered && hovered)
            : props.children;

    return React.cloneElement(React.Children.only(child), {
        onMouseEnter: () => {
            setHovered(true);
            if(showHovered && props.onHoverIn) {
                props.onHoverIn();
            }
        },
        onMouseLeave: () => {
            setHovered(false);
            if(showHovered && props.onHoverOut) {
                props.onHoverOut();
            }
        },

        // prevent hover showing while responder
        onResponderGrant: () => setShowHovered(false),
        onResponderRelease: () => setShowHovered(true),

        // if child is Touchable
        onPressIn: () => setShowHovered(false),
        onPressOut: () => setShowHovered(true)
    });
}

type AnimatedOutputRange<T extends any[]> = { [K in keyof T]: string } | { [K in keyof T]: number };
class SimpleAnimatedValue extends Animated.Value {
    interpolate(config: Animated.InterpolationConfigType): Animated.AnimatedInterpolation;
    interpolate<T extends [number, ...number[]]>(inputRange: T, outputRange: AnimatedOutputRange<T>): Animated.AnimatedInterpolation;
    interpolate(configOrInputRange: any, outputRange?: any): Animated.AnimatedInterpolation {
        if(!Array.isArray(configOrInputRange)) {
            return super.interpolate(configOrInputRange);
        }

        return super.interpolate({
            inputRange: configOrInputRange,
            outputRange: outputRange,
        });
    }
}

/*
 * Using a class here since we might use other wrappers around this.
 * If we use TouchableWithoutFeedback as example the error "Function components cannot be given refs."
 * will appear.
 */
export class HoverAnimatedView extends React.PureComponent<{
    children?: React.ReactNode,

    onHoverIn?: () => void,
    onHoverOut?: () => void,

    hoverStyle?: (animation: SimpleAnimatedValue) => any,
    toValue?: number,
    duration: number
} & ViewProps> {
    private readonly animation: SimpleAnimatedValue;

    constructor(props: any) {
        super(props);

        this.animation = new SimpleAnimatedValue(0);
    }

    render() {
        let style = this.props.style;
        if(!Array.isArray(style)) {
            style = [ style ];
        }
        if(typeof this.props.hoverStyle === "function") {
            style.push(this.props.hoverStyle(this.animation));
        }

        return (
            <Hoverable
                onHoverIn={() => {
                    Animated.timing(this.animation, {
                        useNativeDriver: false,
                        duration: this.props.duration,
                        toValue: typeof this.props.toValue === "undefined" ? 100 : this.props.toValue,
                    }).start();

                    if(this.props.onHoverIn) {
                        this.props.onHoverIn();
                    }
                }}

                onHoverOut={() => {
                    Animated.timing(this.animation, {
                        useNativeDriver: false,
                        duration: this.props.duration,
                        toValue: 0,
                    }).start();

                    if(this.props.onHoverOut) {
                        this.props.onHoverOut();
                    }
                }}
            >
                <Animated.View {...this.props} style={style}>
                    {this.props.children}
                </Animated.View>
            </Hoverable>
        );
    }
}
