declare module 'encoding-japanese' {
  export function stringToCode(value: string): number[];
  export function convert(value: number[], options: { to: string; from: string; type: 'array' }): number[];
}
