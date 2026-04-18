import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  ({ label, error, secureTextEntry, ...props }, ref) => {
    const [revealed, setRevealed] = useState(false);
    const isPassword = secureTextEntry === true;

    return (
      <View>
        <Text className="mb-2 text-sm font-medium text-brand-100/80">
          {label}
        </Text>
        <View className="flex-row items-center rounded-2xl border border-white/10 bg-white/5">
          <TextInput
            ref={ref}
            placeholderTextColor="#67e8f950"
            secureTextEntry={isPassword && !revealed}
            className="flex-1 px-4 py-4 text-base text-white"
            {...props}
          />
          {isPassword ? (
            <Pressable
              onPress={() => setRevealed((v) => !v)}
              hitSlop={8}
              className="px-4 py-4"
            >
              <Ionicons
                name={revealed ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color="#cffafe"
              />
            </Pressable>
          ) : null}
        </View>
        {error ? (
          <Text className="mt-1.5 text-sm text-rose-300">{error}</Text>
        ) : null}
      </View>
    );
  },
);

TextField.displayName = 'TextField';
