import { Easing as REasing } from 'react-native';

export const Easing = {
    step0: REasing.step0,
    step1: REasing.step1,
    linear: REasing.linear,
    ease: REasing.ease,
    quad: REasing.quad,
    cubic: REasing.cubic,
    poly: REasing.poly,
    sin: REasing.sin,
    circle: REasing.circle,
    exp: REasing.exp,
    elastic: REasing.elastic,
    back: REasing.back,
    bounce: REasing.bounce,
    bezier: REasing.bezier,
    in: REasing.in,
    out: REasing.out,
    inOut: REasing.inOut,

    easeIn: REasing.bezier(0.42, 0, 1, 1),
    easeOut: REasing.bezier(0, 0, 0.58, 1),
    easeInOut: REasing.bezier(0.42, 0, 0.58, 1),

    easeInCubic: REasing.bezier(0.55, 0.055, 0.675, 0.19),
    easeOutCubic: REasing.bezier(0.215, 0.61, 0.355, 1.0),
    easeInOutCubic: REasing.bezier(0.645, 0.045, 0.355, 1.0),

    easeInCirc: REasing.bezier(0.6, 0.04, 0.98, 0.335),
    easeOutCirc: REasing.bezier(0.075, 0.82, 0.165, 1.0),
    easeInOutCirc: REasing.bezier(0.785, 0.135, 0.15, 0.86),

    easeInExpo: REasing.bezier(0.95, 0.05, 0.795, 0.035),
    easeOutExpo: REasing.bezier(0.19, 1.0, 0.22, 1.0),
    easeInOutExpo: REasing.bezier(1.0, 0.0, 0.0, 1.0),

    easeInQuad: REasing.bezier(0.55, 0.085, 0.68, 0.53),
    easeOutQuad: REasing.bezier(0.25, 0.46, 0.45, 0.94),
    easeInOutQuad: REasing.bezier(0.455, 0.03, 0.515, 0.955),

    easeInQuart: REasing.bezier(0.895, 0.03, 0.685, 0.22),
    easeOutQuart: REasing.bezier(0.165, 0.84, 0.44, 1.0),
    easeInOutQuart: REasing.bezier(0.77, 0.0, 0.175, 1.0),

    easeInQuint: REasing.bezier(0.755, 0.05, 0.855, 0.06),
    easeOutQuint: REasing.bezier(0.23, 1.0, 0.32, 1.0),
    easeInOutQuint: REasing.bezier(0.86, 0.0, 0.07, 1.0),

    easeInSine: REasing.bezier(0.47, 0.0, 0.745, 0.715),
    easeOutSine: REasing.bezier(0.39, 0.575, 0.565, 1.0),
    easeInOutSine: REasing.bezier(0.445, 0.05, 0.55, 0.95),

    easeInBack: REasing.bezier(0.6, -0.28, 0.735, 0.045),
    easeOutBack: REasing.bezier(0.175, 0.885, 0.32, 1.275),
    easeInOutBack: REasing.bezier(0.68, -0.55, 0.265, 1.55),

    easeInElastic: REasing.out(REasing.elastic(2)),
    easeInElasticCustom: (bounciness = 2) => REasing.out(REasing.elastic(bounciness)),
    easeOutElastic: REasing.in(REasing.elastic(2)),
    easeOutElasticCustom: (bounciness = 2) => REasing.in(REasing.elastic(bounciness)),
    easeInOutElastic: REasing.inOut(REasing.out(REasing.elastic(2))),
    easeInOutElasticCustom: (bounciness = 2) => REasing.inOut(REasing.out(REasing.elastic(bounciness))),

    easeInBounce: REasing.out(REasing.bounce),
    easeOutBounce: REasing.in(REasing.bounce),
    easeInOutBounce: REasing.inOut(REasing.out(REasing.bounce)),
};
export default Easing;
