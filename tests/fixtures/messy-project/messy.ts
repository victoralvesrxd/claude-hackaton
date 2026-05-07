// TODO: refactor this whole module
export function tangled(a: number, b: number, c: number, d: number, e: number, f: number) {
  if (a > 0 && a < 1000) {
    if (b > 0 && b < 1000) {
      if (c > 0 && c < 1000) {
        if (d > 0 && d < 1000) {
          if (e > 0 && e < 1000) {
            if (f > 0 && f < 1000) {
              return 999;
            }
          }
        }
      }
    }
  }
  return 0;
}
