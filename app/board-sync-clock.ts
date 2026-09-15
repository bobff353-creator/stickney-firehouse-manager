/** Same content + same clock = same slide on each TV, independent of load time.
 * Manual selections and paused editing are managed by each screen's UI.
 */
export function synchronizedSlide(now: number, duration: number, count: number) {
  return count > 0 ? Math.floor(now / duration) % count : 0;
}
