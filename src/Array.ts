Object.defineProperty(Array.prototype, 'last', {
    get : function() {
        return this[this.length - 1];
    }
});

interface Array<T> {
    last: T | undefined
}
