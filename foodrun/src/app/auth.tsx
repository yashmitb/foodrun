import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppBackground } from '@/components/AppBackground';
import { PrimaryButton } from '@/components/buttons';
import { DigitBoxes } from '@/components/DigitBoxes';
import { GlassCard } from '@/components/GlassCard';
import * as auth from '@/data/auth';
import { webCryptoReady } from '@/lib/webcrypto-polyfill';
import { useStore } from '@/data/store';
import { colors, fonts, layout, type } from '@/theme';

/**
 * §2 — only @ucsd.edu emails, by one-time code.
 *
 * The two steps are the same whether the code came from Supabase or from the
 * demo stub; `@/data/auth` decides which, based on whether a project is
 * configured. The only thing the screen changes is how many digits it asks
 * for and what it tells the user, because a grader typing 1234 deserves to
 * know why it worked.
 */
export default function Auth() {
  const signIn = useStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const len = auth.codeLength;

  const emailOk = auth.isUcsdEmail(email);

  const sendCode = async () => {
    if (!emailOk) {
      // Return on an empty field is not a mistake worth naming; the button
      // already says what is needed.
      setError(email.trim() ? 'Use your @ucsd.edu email.' : null);
      return;
    }
    setBusy(true);
    const result = await auth.sendCode(email);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setCode('');
    setStep('code');
  };

  /**
   * One tap, no inbox. Preferred over the code where it is available, which
   * is why it sits above the email field rather than under it.
   */
  const google = async () => {
    setBusy(true);
    const result = await auth.signInWithGoogle();
    setBusy(false);
    if (!result.ok) {
      // Cancelling is not an error worth shouting about.
      setError(result.message === 'Sign-in cancelled.' ? null : result.message);
      return;
    }
    signIn(result.email ?? '');
    router.replace('/onboarding');
  };

  const verify = async () => {
    if (code.length !== len) return;
    setBusy(true);
    const result = await auth.verifyCode(email, code);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      setCode('');
      return;
    }
    signIn(email.trim().toLowerCase());
    router.replace('/onboarding');
  };

  return (
    <AppBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.wrap}
        >
          <Text style={[type.eyebrow as object, { fontFamily: fonts.semiBold }]}>FoodRun</Text>
          <Text style={[type.largeTitle as object, { fontFamily: fonts.bold, marginTop: 4 }]}>
            Dining hall food,{'\n'}walked to you.
          </Text>
          <GlassCard style={{ marginTop: 24 }}>
            {step === 'email' ? (
              <>
                {auth.googleAvailable ? (
                  <>
                    <PrimaryButton
                      label={busy ? 'Opening Google…' : 'Continue with UCSD Google'}
                      disabled={busy}
                      onPress={google}
                    />
                    {__DEV__ ? (
                      // The single most useful thing to see when the browser
                      // comes back to the wrong place: this exact string has
                      // to be on Supabase's redirect allow list.
                      <Text selectable style={styles.devUri}>
                        redirect: {auth.googleRedirectUri()}
                        {'\n'}pkce: {webCryptoReady ? 'S256' : 'PLAIN — insecure'}
                      </Text>
                    ) : null}
                    <View style={styles.orRow}>
                      <View style={styles.rule} />
                      <Text style={styles.orText}>or</Text>
                      <View style={styles.rule} />
                    </View>
                  </>
                ) : null}
                <Text style={styles.label}>UCSD EMAIL</Text>
                <TextInput
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    setError(null);
                  }}
                  placeholder="you@ucsd.edu"
                  placeholderTextColor="#A6AFBC"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  style={styles.input}
                  onSubmitEditing={sendCode}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <PrimaryButton
                  label={busy ? 'Sending…' : emailOk ? 'Send code' : 'Use your UCSD email'}
                  disabled={!emailOk || busy}
                  onPress={sendCode}
                  style={{ marginTop: 16 }}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>CODE SENT TO {email.toUpperCase()}</Text>
                <View style={{ marginTop: 10 }}>
                  <DigitBoxes value={code} onChange={setCode} length={len} showPaste={false} />
                </View>
                <Text style={styles.hint}>
                  {auth.authMode === 'demo'
                    ? 'Demo build: any 4 digits work.'
                    : `We emailed a ${len}-digit code. It expires in an hour.`}
                </Text>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <PrimaryButton
                  label={
                    busy
                      ? 'Checking…'
                      : code.length === len
                        ? 'Sign in'
                        : `Enter the ${len}-digit code`
                  }
                  disabled={code.length !== len || busy}
                  onPress={verify}
                  style={{ marginTop: 16 }}
                />
              </>
            )}
          </GlassCard>
          <Text style={styles.foot}>Only UCSD students can join. Triton2Go handles the food.</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </AppBackground>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: layout.screenMargin },
  label: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    color: colors.faint,
    letterSpacing: 0.5,
  },
  input: {
    marginTop: 8,
    fontSize: 17,
    fontFamily: fonts.regular,
    color: colors.ink,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  error: { marginTop: 8, fontSize: 13, color: colors.danger, fontFamily: fonts.medium },
  devUri: {
    marginTop: 8,
    fontSize: 10,
    color: colors.faint,
    fontFamily: fonts.regular,
  },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 18 },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  orText: { fontSize: 13, color: colors.faint, fontFamily: fonts.medium },
  hint: { marginTop: 10, fontSize: 12, color: colors.faint, fontFamily: fonts.regular },
  foot: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 13,
    color: colors.muted,
    fontFamily: fonts.regular,
  },
});
