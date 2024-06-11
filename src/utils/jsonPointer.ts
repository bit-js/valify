const decodePointerMapper: string[] = [];
decodePointerMapper[48] = '~';
decodePointerMapper[49] = '/';

function decodePointerReplacer(str: string): string {
    return decodePointerMapper[str.charCodeAt(1)];
}

export function decodeComponent(pointer: string): string {
    return decodeURIComponent(pointer.replace(/~[01]/g, decodePointerReplacer));
}
