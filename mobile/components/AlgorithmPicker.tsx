import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

export interface AlgorithmOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

interface Props<T extends string> {
  readonly options: readonly AlgorithmOption<T>[];
  readonly value: T;
  readonly onChange: (next: T) => void;
}

const ACTIVE_BG = '#67e8f9';
const ACTIVE_TEXT = '#020617';
const INACTIVE_BG = 'rgba(255,255,255,0.05)';
const INACTIVE_BORDER = 'rgba(255,255,255,0.2)';
const INACTIVE_TEXT = 'rgba(255,255,255,0.8)';

export function AlgorithmPicker<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.content}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            hitSlop={6}
            style={[
              styles.pill,
              {
                backgroundColor: isActive ? ACTIVE_BG : INACTIVE_BG,
                borderColor: isActive ? ACTIVE_BG : INACTIVE_BORDER,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                { color: isActive ? ACTIVE_TEXT : INACTIVE_TEXT },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  pill: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
});
