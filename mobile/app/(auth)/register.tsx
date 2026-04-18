import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AuthScreen } from '@/components/AuthScreen';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import type { AuthResponse } from '@/types/api';

export default function Register() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        auth: false,
        body: { email: email.trim(), password },
      });
      await setToken(res.access_token);
      router.replace('/(app)/onboarding');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Network error. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreen title="Create account" subtitle="Join Rapsodium in seconds.">
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password-new"
        placeholder="At least 8 characters"
      />
      <TextField
        label="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoComplete="password-new"
        placeholder="Repeat your password"
      />

      {error ? (
        <Text className="text-center text-sm text-rose-300">{error}</Text>
      ) : null}

      <PrimaryButton
        label="Create account"
        onPress={handleSubmit}
        loading={submitting}
      />

      <View className="mt-2 flex-row justify-center">
        <Text className="text-brand-100/70">Already have one? </Text>
        <Link href="/(auth)/login" replace>
          <Text className="font-semibold text-brand-300">Log in</Text>
        </Link>
      </View>
    </AuthScreen>
  );
}
