import * as Clipboard from 'expo-clipboard';
import { ClipboardPaste } from 'lucide-react-native';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts } from '@/theme';

type Props = {
  value: string;
  onChange: (digits: string) => void;
  length?: number;
  /** §6.3 — inline error instead of silently stripping non-digits. */
  onNonDigits?: () => void;
  showPaste?: boolean;
};

/**
 * §6.3 Step 2 — OTP-style digit boxes for the Triton2Go last 4. Numeric
 * keypad, auto-advance, backspace goes back (one hidden input drives 4 boxes).
 * Paste is a quiet text action (P3: visually distinct from Scan).
 */
export function DigitBoxes({ value, onChange, length = 4, onNonDigits, showPaste = true }: Props) {
  const input = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [focused, setFocused] = useState(false);

  const handle = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, length);
    if (raw !== digits && raw.length > 0 && /\D/.test(raw)) onNonDigits?.();
    onChange(digits);
  };

  const paste = async () => {
    const text = await Clipboard.getStringAsync();
    handle(text ?? '');
  };

  const activeIndex = Math.min(value.length, length - 1);

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.boxes}
        onPress={() => input.current?.focus()}
        accessibilityLabel="Last 4 digits of your Triton2Go order number"
      >
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            style={[styles.box, focused && i === activeIndex && value.length < length && styles.boxActive]}
          >
            <Text style={styles.digit}>{value[i] ?? ''}</Text>
          </View>
        ))}
        <TextInput
          ref={input}
          value={value}
          onChangeText={handle}
          keyboardType="number-pad"
          maxLength={length + 2}
          style={styles.hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          caretHidden
        />
      </Pressable>
      {showPaste ? (
        <Pressable onPress={paste} style={styles.paste} accessibilityRole="button" accessibilityLabel="Paste">
          <ClipboardPaste size={14} color={colors.navy} strokeWidth={1.8} />
          <Text style={styles.pasteText}>Paste</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  boxes: { flexDirection: 'row', gap: 8 },
  box: {
    width: 46,
    height: 54,
    borderRadius: 12,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.orange },
  digit: {
    fontSize: 24,
    fontFamily: fonts.bold,
    color: colors.navy,
    fontVariant: ['tabular-nums'],
  },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
  paste: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6 },
  pasteText: { fontSize: 14, fontFamily: fonts.semiBold, color: colors.navy },
});
