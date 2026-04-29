/**
 * useTypeReveal — replays the .type-reveal CSS animation for dynamic
 * strings whose value can change at runtime. Returns a `key` that
 * changes whenever `value` changes, plus the inline style payload so
 * the consumer doesn't have to know the CSS variable name.
 *
 * The .type-reveal animation runs on `width` driven by steps(). React
 * won't re-trigger a CSS animation just because the underlying string
 * changes — we therefore re-mount the element by passing the returned
 * `key` to the React node. `style` carries `--type-reveal-ch` set to
 * the value's character count so the keyframe stretches correctly.
 *
 * Honors prefers-reduced-motion via the global CSS rule that disables
 * the keyframe and pins width to the final state.
 *
 * Usage:
 *
 *   const { key, style } = useTypeReveal(routeLine);
 *   return <span key={key} className="type-reveal" style={style}>{routeLine}</span>;
 */

import { useMemo } from "react";

export interface TypeRevealResult {
  key: string;
  style: React.CSSProperties;
}

export function useTypeReveal(value: string): TypeRevealResult {
  return useMemo<TypeRevealResult>(() => {
    const ch = value.length;
    return {
      key: `type-reveal-${value}`,
      style: { ["--type-reveal-ch" as never]: String(ch) },
    };
  }, [value]);
}
