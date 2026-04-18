import { ActivityIndicator, Pressable, Text } from 'react-native';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      className={`w-full rounded-2xl px-6 py-4 ${
        isDisabled ? 'bg-brand-400/50' : 'bg-brand-400 active:bg-brand-500'
      }`}
    >
      {loading ? (
        <ActivityIndicator color="#020617" />
      ) : (
        <Text className="text-center text-base font-semibold text-ink-950">
          {label}
        </Text>
      )}
    </Pressable>
  );
}
