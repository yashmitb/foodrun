import { LinearGradient } from 'expo-linear-gradient';
import React, { useId } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { backgroundGradient, blobGradient, blobs } from '@/theme';

/**
 * §3.2 — Vertical gradient + three large soft blobs.
 *
 * The blobs used to be solid circles under a full-bleed `BlurView`. That is
 * one `UIVisualEffectView` covering the whole screen on every route, and iOS
 * re-renders a visual effect view's blur from the live content beneath it on
 * every frame, whether or not anything moved. Stacked under the per-card and
 * tab-bar blurs it cost six to ten offscreen GPU passes per frame, and no
 * spring looks smooth at 35fps.
 *
 * SVG radial gradients give the same falloff for free — they rasterise once,
 * because nothing behind them ever changes. The blur was buying nothing
 * anyway: there was no detail back there to blur, only a gradient.
 *
 * The page gradient stays a real `LinearGradient` filling the whole frame.
 * Drawing it as an SVG ellipse left the corners uncovered, which read as the
 * colour having disappeared.
 */
export function AppBackground({ children }: { children?: React.ReactNode }) {
  const { width, height } = useWindowDimensions();
  /**
   * Tab screens stay mounted, so several of these exist at once. On web they
   * share one DOM, and duplicate SVG gradient ids would make every blob
   * resolve to whichever was defined first.
   */
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  // The drawn circle is the blur's full extent, not the original radius.
  const rings = blobs.map((b) => ({ b, ...blobGradient(b.r, b.blur) }));

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={backgroundGradient.colors}
        locations={backgroundGradient.locations}
        style={StyleSheet.absoluteFill}
      />
      {/* Sized in pixels, not percentages: a circle's percentage radius
          resolves against the viewport diagonal, which is not what we want. */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          {rings.map(({ b, stops }, i) => (
            <RadialGradient key={i} id={`blob-${uid}-${i}`} cx="50%" cy="50%" r="50%">
              {stops.map((st) => (
                <Stop
                  key={st.offset}
                  offset={st.offset}
                  stopColor={b.core}
                  stopOpacity={b.opacity * st.mul}
                />
              ))}
            </RadialGradient>
          ))}
        </Defs>
        {rings.map(({ b, outer }, i) => (
          <Circle
            key={i}
            cx={b.x * width}
            cy={b.y * height}
            r={outer}
            fill={`url(#blob-${uid}-${i})`}
          />
        ))}
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: backgroundGradient.colors[1] },
});
