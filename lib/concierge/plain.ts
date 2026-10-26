/**
 * Text from a visitor, made safe to keep and to show to the team: control characters out (a NUL cannot be stored in a text or
 * jsonb column at all), and the bidirectional controls that can make a line read in a different order than it was written.
 * Line breaks and tabs stay.
 */
const UNSAFE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g;

export const plain = (text: string) => text.replace(UNSAFE, "");
