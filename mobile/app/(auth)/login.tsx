import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AuthScreen } from '@/components/AuthScreen';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextField } from '@/components/TextField';
import { ApiError, apiFetch } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import type { AuthResponse } from '@/types/api';

export default function Login() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        auth: false,
        body: { email: email.trim(), password },
      });
      await setToken(res.access_token);
      router.replace('/(app)/(tabs)');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Invalid email or password.');
      } else if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Network error. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthScreen title="Welcome back" subtitle="Log in to continue.">
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
        autoComplete="password"
        placeholder="••••••••"
      />

      {error ? (
        <Text className="text-center text-sm text-rose-300">{error}</Text>
      ) : null}

      <PrimaryButton label="Log in" onPress={handleSubmit} loading={submitting} />

      <View className="mt-2 flex-row justify-center">
        <Text className="text-brand-100/70">No account yet? </Text>
        <Link href="/(auth)/register" replace>
          <Text className="font-semibold text-brand-300">Register</Text>
        </Link>
      </View>
    </AuthScreen>
  );
}
