import { router, useLocalSearchParams } from 'expo-router';
import { HelpCircle, QrCode, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { PrimaryButton } from '@/components/buttons';
import { DigitBoxes } from '@/components/DigitBoxes';
import { useToast } from '@/components/Toast';
import { destinationById, hallById } from '@/data/dining';
import { useJoinDraft } from '@/data/joinDraft';
import { useStore } from '@/data/store';
import { clockTime, money } from '@/lib/format';
import { SPRING_SHEET, haptic } from '@/lib/motion';
import { colors, fonts, glass } from '@/theme';

/** Past this far down (or this fast), the sheet goes rather than snapping back. */
const DISMISS_DISTANCE = 130;
const DISMISS_VELOCITY = 900;

function dropSpotsFor(destName: string): string[] {
  if (destName.includes('Geisel'))
    return ['Geisel 1F, Lobby', 'Geisel 2F, Table 14', 'Geisel 8F, East window'];
  return [`${destName}, Lobby`, `${destName}, Front desk`, `${destName}, Entrance`];
}

/**
 * §6.3 / §6.4 — Join sheet: 3 numbered steps, then Review + Confirm.
 * Hall locked to the run's start (error prevention). Restaurant required.
 * Last 4 only. Scan is a big distinct control; Paste stays quiet (P3).
 */
export default function JoinSheet() {
  const { runId } = useLocalSearchParams<{ runId: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const me = useStore((s) => s.me);
  const run = useStore((s) => s.runs.find((r) => r.id === runId));
  const joinRun = useStore((s) => s.joinRun);
  const recentSpots = useStore((s) => s.recentSpots);

  const draft = useJoinDraft();
  const [reviewing, setReviewing] = useState(false);
  const [digitError, setDigitError] = useState(false);
  const [pickingSpot, setPickingSpot] = useState(false);
  const [customSpot, setCustomSpot] = useState('');

  useEffect(() => {
    if (runId && draft.runId !== runId) draft.start(runId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  // Sheet presentation + drag-to-dismiss.
  const translateY = useSharedValue(900);
  const dragging = useSharedValue(0);

  /**
   * The keyboard is tracked as a shared value, so the sheet rides it on the UI
   * thread and the two move as one surface. `KeyboardAvoidingView` cannot do
   * that here: it is bottom-anchored inside `justifyContent: 'flex-end'`, so
   * `behavior="padding"` grew the sheet by the keyboard's height instead of
   * lifting it, pushing the header and close button off the top of the screen.
   *
   * `useAnimatedKeyboard` is deprecated in favour of react-native-keyboard-
   * controller, which needs native code and therefore a dev build — this has
   * to keep working in Expo Go, so it stays for now.
   */
  const keyboard = useAnimatedKeyboard();
  const { height: winH } = useWindowDimensions();
  const [kbUp, setKbUp] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', () => setKbUp(true));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Leave room for the keyboard rather than growing past the top of the screen.
  const maxSheetBody = kbUp ? Math.round(winH * 0.42) : Math.min(640, Math.round(winH * 0.78));

  useEffect(() => {
    translateY.set(withSpring(0, SPRING_SHEET));
  }, [translateY]);

  const dismiss = React.useCallback(() => {
    draft.clear();
    router.back();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animateOut = React.useCallback(() => {
    translateY.set(withTiming(900, { duration: 220 }, (done) => {
      if (done) runOnJS(dismiss)();
    }));
  }, [translateY, dismiss]);

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        // Only a deliberate downward drag counts, and only from the handle —
        // a Pan across the whole sheet swallowed taps on the digit boxes and
        // made the list unscrollable, because it won the touch every time.
        .activeOffsetY(10)
        .failOffsetY(-24)
        .onStart(() => {
          dragging.set(1);
        })
        .onUpdate((e) => {
          // Rubber-band upward drags so the sheet resists instead of detaching.
          translateY.set(e.translationY < 0 ? e.translationY * 0.22 : e.translationY);
        })
        .onEnd((e) => {
          dragging.set(0);
          if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
            runOnJS(haptic)('light');
            translateY.set(
              withTiming(900, { duration: 200 }, (done) => {
                if (done) runOnJS(dismiss)();
              }),
            );
          } else {
            translateY.set(withSpring(0, { ...SPRING_SHEET, velocity: e.velocityY }));
          }
        }),
    [translateY, dragging, dismiss],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() - keyboard.height.get() }],
  }));

  // Scrim tracks the drag, so pulling down reveals the list behind it.
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: Math.max(0, 1 - translateY.get() / 420),
  }));

  if (!run) return null;
  const hall = hallById(run.hallId);
  const dest = destinationById(run.destinationId);
  const destShort = dest?.name.replace(' Library', '') ?? '';
  const full = run.spotsLeft <= 0;

  const missing = !draft.restaurant
    ? 'Pick a restaurant'
    : draft.last4.length < 4
      ? 'Add last 4 digits'
      : !draft.dropSpot
        ? 'Set your drop spot'
        : null;

  const close = animateOut;

  const confirm = () => {
    const result = joinRun({
      runId: run.id,
      restaurant: draft.restaurant!,
      last4: draft.last4,
      orderName: draft.orderName || me?.firstName || '',
      dropSpot: draft.dropSpot!,
    });
    if (!result.ok) {
      haptic('warning');
      toast.show({
        message:
          result.reason === 'has_order'
            ? 'You already have an order in flight. Cancel it before joining another run.'
            : result.reason === 'full'
              ? 'This run just filled up.'
              : "That run isn't available anymore.",
        action:
          result.reason === 'has_order'
            ? { label: 'View', onPress: () => router.replace('/order') }
            : undefined,
      });
      draft.clear();
      router.back();
      return;
    }
    haptic('success');
    draft.clear();
    router.replace('/order');
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View style={[styles.sheetWrap, sheetStyle]}>
        <View style={styles.sheetBlur}>
          <GestureDetector gesture={pan}>
            <View style={styles.grabArea}>
              <View style={styles.grab} />
            </View>
          </GestureDetector>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: maxSheetBody }}
          >
              <View style={styles.header}>
                <Avatar initials={run.runner.initials} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>
                    {reviewing ? 'Confirm your order' : `Join ${run.runner.firstName}'s run`}
                  </Text>
                  <Text style={styles.sub}>
                    {hall?.name} → {destShort} · leaves {clockTime(run.leaveAt)}
                  </Text>
                </View>
                <Pressable onPress={close} style={styles.x} accessibilityLabel="Close">
                  <X size={16} color={colors.navy} strokeWidth={2.2} />
                </Pressable>
              </View>

              {reviewing ? (
                <>
                  {/* §6.4 — Review summary */}
                  <View style={styles.summary}>
                    {[
                      ['Runner', `${run.runner.name} · ★ ${run.runner.ratingAvg.toFixed(1)}`],
                      ['Route', `${hall?.name} → ${destShort}`],
                      ['Leaves', clockTime(run.leaveAt)],
                      ['Order', `${draft.restaurant} · #••${draft.last4.slice(2)}`],
                      ['Name on order', draft.orderName || me?.firstName || '—'],
                      ['Drop spot', draft.dropSpot ?? ''],
                    ].map(([k, v]) => (
                      <View key={k} style={styles.summaryRow}>
                        <Text style={styles.summaryKey}>{k}</Text>
                        <Text style={styles.summaryVal} numberOfLines={1}>
                          {v}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.cancelNote}>
                    Free cancel for 2 minutes after confirming. {run.runner.firstName} won&apos;t grab
                    your bag until the window ends.
                  </Text>
                  <PrimaryButton
                    label={`Confirm · ${money(run.feeCents)}`}
                    onPress={confirm}
                    style={{ marginTop: 14 }}
                  />
                  <Pressable onPress={() => setReviewing(false)} style={{ padding: 12 }}>
                    <Text style={styles.backLink}>Back to edit</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  {/* Step 1 (O2) */}
                  <View style={styles.field}>
                    <Text style={styles.label}>1 · WHERE&apos;S YOUR FOOD FROM?</Text>
                    <View style={styles.lockedRow}>
                      <Text style={styles.lockedHall}>{hall?.name}</Text>
                      <Text style={styles.lockedHint}>locked to this run</Text>
                    </View>
                    <View style={styles.chips}>
                      {(hall?.restaurants.length ? hall.restaurants : ['Main line']).map((r) => (
                        <Pressable
                          key={r}
                          onPress={() => draft.patch({ restaurant: r })}
                          style={[styles.chip, draft.restaurant === r && styles.chipOn]}
                        >
                          <Text
                            style={[styles.chipText, draft.restaurant === r && styles.chipTextOn]}
                          >
                            {r}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Step 2 (O1) */}
                  <View style={styles.field}>
                    <Text style={styles.label}>2 · TRITON2GO ORDER NUMBER</Text>
                    <View style={{ marginTop: 10 }}>
                      <DigitBoxes
                        value={draft.last4}
                        onChange={(d) => {
                          draft.patch({ last4: d });
                          setDigitError(false);
                        }}
                        onNonDigits={() => setDigitError(true)}
                      />
                    </View>
                    {digitError ? (
                      <Text style={styles.error}>
                        Digits only. Use the last 4 of your order number.
                      </Text>
                    ) : (
                      <Text style={styles.hint}>Last 4 digits of your Triton2Go order number.</Text>
                    )}
                    <TextInput
                      value={draft.orderName}
                      onChangeText={(t) => draft.patch({ orderName: t })}
                      placeholder={`Name on the order (default: ${me?.firstName ?? 'you'})`}
                      placeholderTextColor="#A6AFBC"
                      style={styles.nameInput}
                    />
                  </View>

                  {/* Step 3 — Scan big + distinct (P3), manual fallback (heuristic 7) */}
                  <View style={styles.field}>
                    <Text style={styles.label}>3 · WHERE SHOULD IT GO?</Text>
                    {draft.dropSpot ? (
                      <View style={styles.spotRow}>
                        <Text style={styles.spotText}>
                          {draft.dropSpot} <Text style={{ color: colors.success }}>✓</Text>
                        </Text>
                        <Pressable
                          onPress={() =>
                            router.push({ pathname: '/scan', params: { runId: run.id } })
                          }
                        >
                          <Text style={styles.rescan}>Rescan</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() =>
                          router.push({ pathname: '/scan', params: { runId: run.id } })
                        }
                        style={styles.scanBtn}
                        accessibilityRole="button"
                      >
                        <QrCode size={22} color={colors.navy} strokeWidth={1.8} />
                        <Text style={styles.scanText}>Scan the QR on your table</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={() => setPickingSpot((v) => !v)} style={{ marginTop: 10 }}>
                      <Text style={styles.noSticker}>No sticker? Pick a spot</Text>
                    </Pressable>
                    {pickingSpot ? (
                      <View style={{ marginTop: 8 }}>
                        {[...new Set([...recentSpots, ...dropSpotsFor(dest?.name ?? '')])]
                          .slice(0, 5)
                          .map((s) => (
                            <Pressable
                              key={s}
                              onPress={() => {
                                draft.patch({ dropSpot: s });
                                setPickingSpot(false);
                              }}
                              style={styles.spotOption}
                            >
                              <Text style={styles.spotOptionText}>{s}</Text>
                            </Pressable>
                          ))}
                        <View style={styles.customRow}>
                          <TextInput
                            value={customSpot}
                            onChangeText={setCustomSpot}
                            placeholder="Type a spot (e.g. CSE 2154 door)"
                            placeholderTextColor="#A6AFBC"
                            style={[styles.nameInput, { flex: 1, marginTop: 0 }]}
                            onSubmitEditing={() => {
                              if (customSpot.trim()) {
                                draft.patch({ dropSpot: customSpot.trim() });
                                setPickingSpot(false);
                              }
                            }}
                          />
                        </View>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Delivery fee · charged after drop-off</Text>
                    <Text style={styles.feeVal}>{money(run.feeCents)}</Text>
                  </View>

                  <PrimaryButton
                    label={full ? 'This run just filled up' : (missing ?? 'Review')}
                    disabled={full || !!missing}
                    onPress={() => setReviewing(true)}
                  />
                  <Pressable
                    onPress={() =>
                      toast.show({
                        message:
                          'A student already walking carries your Triton2Go bag. Fee charged only after drop-off.',
                      })
                    }
                    style={styles.howRow}
                  >
                    <HelpCircle size={14} color={colors.muted} strokeWidth={1.8} />
                    <Text style={styles.howText}>How it works</Text>
                  </Pressable>
                </>
              )}
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(18,30,45,0.28)',
  },
  sheetWrap: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  sheetBlur: { backgroundColor: glass.sheetFill, paddingHorizontal: 20 },
  grabArea: { paddingTop: 10, paddingBottom: 14, alignItems: 'center' },
  grab: {
    width: 38,
    height: 5,
    borderRadius: 5,
    backgroundColor: 'rgba(18,53,91,0.2)',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  title: { fontSize: 17, fontFamily: fonts.semiBold, color: colors.ink },
  sub: { fontSize: 14, color: colors.muted, fontFamily: fonts.regular, marginTop: 2 },
  x: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(18,53,91,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
  },
  label: { fontSize: 12, fontFamily: fonts.semiBold, color: colors.faint, letterSpacing: 0.5 },
  lockedRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 },
  lockedHall: { fontSize: 17, fontFamily: fonts.semiBold, color: colors.navy },
  lockedHint: { fontSize: 12, color: colors.faint, fontFamily: fonts.regular },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(18,53,91,0.08)',
  },
  chipOn: { backgroundColor: colors.navy },
  chipText: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.navy },
  chipTextOn: { color: colors.white },
  error: { marginTop: 8, fontSize: 13, color: colors.danger, fontFamily: fonts.medium },
  hint: { marginTop: 8, fontSize: 12, color: colors.faint, fontFamily: fonts.regular },
  nameInput: {
    marginTop: 10,
    fontSize: 15,
    fontFamily: fonts.regular,
    color: colors.ink,
    backgroundColor: '#F7F9FC',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  scanBtn: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(18,53,91,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(18,53,91,0.18)',
    borderStyle: 'dashed',
  },
  scanText: { fontSize: 15, fontFamily: fonts.semiBold, color: colors.navy },
  spotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  spotText: { fontSize: 17, fontFamily: fonts.semiBold, color: colors.ink, flex: 1 },
  rescan: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.navy, padding: 6 },
  noSticker: { fontSize: 13, fontFamily: fonts.semiBold, color: colors.navy },
  spotOption: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  spotOptionText: { fontSize: 15, color: colors.ink, fontFamily: fonts.regular },
  customRow: { flexDirection: 'row', marginTop: 10 },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 16,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  feeLabel: { fontSize: 14, color: colors.muted, fontFamily: fonts.regular },
  feeVal: { fontSize: 22, color: colors.navy, fontFamily: fonts.bold },
  summary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    gap: 16,
  },
  summaryKey: { fontSize: 13, color: colors.faint, fontFamily: fonts.medium },
  summaryVal: { fontSize: 14, color: colors.ink, fontFamily: fonts.semiBold, flexShrink: 1 },
  cancelNote: { marginTop: 12, fontSize: 13, color: colors.muted, fontFamily: fonts.regular },
  backLink: { textAlign: 'center', fontSize: 14, color: colors.muted, fontFamily: fonts.medium },
  howRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
  },
  howText: { fontSize: 13, color: colors.muted, fontFamily: fonts.medium },
});
