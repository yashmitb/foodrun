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
import { useStore } from '@/data/store';
import { colors, fonts, layout, type } from '@/theme';

/**
 * §2 — only @ucsd.edu emails. Mock OTP for now (any 4 digits work);
 * swaps for Supabase email OTP in Phase 3 with the same two steps.
 */
export default function Auth() {
  const signIn = useStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^[^@\s]+@ucsd\.edu$/i.test(email.trim());

  const sendCode = () => {
    if (!emailOk) {
      // Return on an empty field is not a mistake worth naming; the button
      // already says what is needed.
      setError(email.trim() ? 'Use your @ucsd.edu email.' : null);
      return;
    }
    setError(null);
    setStep('code');
  };

  const verify = () => {
    if (code.length !== 4) return;
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
                  label={emailOk ? 'Send code' : 'Use your UCSD email'}
                  disabled={!emailOk}
                  onPress={sendCode}
                  style={{ marginTop: 16 }}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>CODE SENT TO {email.toUpperCase()}</Text>
                <View style={{ marginTop: 10 }}>
                  <DigitBoxes value={code} onChange={setCode} showPaste={false} />
                </View>
                <Text style={styles.hint}>Demo build: any 4 digits work.</Text>
                <PrimaryButton
                  label={code.length === 4 ? 'Sign in' : 'Enter the 4-digit code'}
                  disabled={code.length !== 4}
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
  hint: { marginTop: 10, fontSize: 12, color: colors.faint, fontFamily: fonts.regular },
  foot: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 13,
    color: colors.muted,
    fontFamily: fonts.regular,
  },
});
