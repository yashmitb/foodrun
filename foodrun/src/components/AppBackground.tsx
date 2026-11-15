import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

import { backgroundGradient, blobs } from '@/theme';

/**
 * §3.2 — Vertical gradient + three large soft blobs.
 *
 * This used to be solid circles under a full-bleed `BlurView`. That is one
 * `UIVisualEffectView` covering the whole screen on every route, and iOS
 * re-renders a visual effect view's blur from the live content beneath it —
 * every frame, whether or not anything moved. Stacked under the per-card and
 * tab-bar blurs it was costing six to ten offscreen GPU passes per frame, and
 * no spring can look smooth at 35fps.
 *
 * SVG radial gradients give the same soft falloff for free: they rasterise
 * once and never again, because nothing behind them changes. The blur was
 * buying nothing anyway — there is no detail back there to blur, only a
 * gradient.
 */
export function AppBackground({ children }: { children?: React.ReactNode }) {
  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id="page" cx="50%" cy="0%" r="110%">
            <Stop offset="0" stopColor={backgroundGradient.colors[0]} />
            <Stop offset="0.45" stopColor={backgroundGradient.colors[1]} />
            <Stop offset="1" stopColor={backgroundGradient.colors[2]} />
          </RadialGradient>
          {blobs.map((b, i) => (
            <RadialGradient key={i} id={`blob${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={b.core} stopOpacity={b.opacity} />
              <Stop offset="0.55" stopColor={b.core} stopOpacity={b.opacity * 0.45} />
              <Stop offset="1" stopColor={b.core} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        <Ellipse cx="50%" cy="50%" rx="75%" ry="75%" fill="url(#page)" />
        {blobs.map((b, i) => (
          <Ellipse
            key={i}
            cx={b.cx}
            cy={b.cy}
            rx={b.size / 2}
            ry={b.size / 2}
            fill={`url(#blob${i})`}
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
