import { TextEncoder } from "./BufferImpl";

export class BufferInputStream {
    private currentOffset: number;
    private length: number;

    constructor(readonly buffer: Buffer, offset?: number, length?: number) {
        this.currentOffset = typeof offset === "number" ? offset : 0;
        this.length = typeof length === "number" ? length : buffer.byteLength;
    }

    remainingBuffer() : Buffer {
        return this.buffer.subarray(this.currentOffset);
    }

    readUInt8() : number {
        const result = this.buffer.readUInt8(this.currentOffset);
        this.currentOffset++;
        return result;
    }

    readUInt32LE() : number {
        const result = this.buffer.readUInt32LE(this.currentOffset);
        this.currentOffset += 4;
        return result;
    }

    readString(length: number, encoding: BufferEncoding = "utf8") : string {
        const result = this.buffer.toString(encoding, this.currentOffset, this.currentOffset + length);
        this.currentOffset += length;
        return result;
    }

    readVarString(encoding: BufferEncoding = "utf8") : string {
        const length = this.readUInt32LE();
        return this.readString(length, encoding);
    }

    readBuffer(length: number) : Buffer {
        const result = this.buffer.subarray(this.currentOffset, this.currentOffset + length);
        this.currentOffset += length;
        return result;
    }

    readArrayBuffer(length: number) : ArrayBuffer {
        if(this.currentOffset + length > this.buffer.byteLength) {
            throw "oob";
        }

        const result = this.buffer.buffer.slice(this.buffer.byteOffset + this.currentOffset, this.buffer.byteOffset + this.currentOffset + length);
        this.currentOffset += length;
        return result;
    }
}

export class BufferOutputStream {
    private static kEmptyBuffer = new Buffer(0);
    private chunks: Buffer[] = [];

    private currentChunk: Buffer | undefined;
    private currentOffset: number = 0;

    constructor(initialCapacity?: number) {
        /* TODO: Use initial capacity */
    }

    private ensureBuffer(length: number): Buffer {
        if(this.currentChunk && this.currentChunk.byteLength - this.currentOffset >= length) {
            return this.currentChunk;
        }

        this.finishCurrentChunk();
        this.currentChunk = Buffer.allocUnsafe(Math.min(length, 128));

        return this.currentChunk;
    }

    private finishCurrentChunk() {
        if(this.currentOffset === 0) {
            return;
        }

        if(this.currentChunk) {
            this.chunks.push(
                this.currentChunk.slice(0, this.currentOffset)
            );
        }

        this.currentChunk = undefined;
        this.currentOffset = 0;
    }

    buffer() : Buffer {
        this.finishCurrentChunk();
        if(this.chunks.length > 1) {
            this.chunks = [ Buffer.concat(this.chunks) ];
        }

        return this.chunks.length === 1 ? this.chunks[0] : BufferOutputStream.kEmptyBuffer;
    }

    arrayBuffer() : ArrayBuffer {
        return this.buffer().buffer;
    }

    writeUInt8(value: number) {
        const buffer = this.ensureBuffer(1);
        this.currentOffset = buffer.writeUInt8(value, this.currentOffset);
    }

    writeUInt32LE(value: number) {
        const buffer = this.ensureBuffer(4);
        this.currentOffset = buffer.writeUInt32LE(value, this.currentOffset);
    }

    writeBuffer(buffer: Buffer) {
        /* TODO: Copy bytes for "small" buffers */
        this.finishCurrentChunk();
        this.chunks.push(buffer);
    }

    writeArrayBuffer(buffer: ArrayBuffer) {
        this.writeBuffer(Buffer.from(buffer, 0, buffer.byteLength));
    }

    writeString(value: string) {
        const encoder = new TextEncoder();
        const encoded = encoder.encode(value);
        this.writeArrayBuffer(encoded);
    }

    writeVarString(value: string) {
        const encoder = new TextEncoder();
        const encoded = encoder.encode(value);

        this.writeUInt32LE(encoded.byteLength);
        this.writeArrayBuffer(encoded);
    }
}