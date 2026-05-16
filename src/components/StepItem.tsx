// src/components/StepItem.tsx
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import type { Step } from '../core/types';

interface StepItemProps {
  step: Step;
  onToggle: () => void;
}

export function StepItem({ step, onToggle }: StepItemProps) {
  const checkStyle = useAnimatedStyle(() => ({
    backgroundColor: withTiming(step.isCompleted ? '#22c55e' : '#1f2937'),
    borderColor: withTiming(step.isCompleted ? '#22c55e' : '#4b5563'),
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: withTiming(step.isLocked ? 0.3 : step.isCompleted ? 0.6 : 1),
  }));

  return (
    <Pressable
      onPress={onToggle}
      disabled={step.isLocked}
      style={styles.container}
    >
      {/* Checkbox circle */}
      <Animated.View
        style={[
          styles.checkbox,
          checkStyle,
        ]}
      >
        {step.isCompleted && (
          <Text style={styles.checkmark}>&#10003;</Text>
        )}
      </Animated.View>

      {/* Step text */}
      <Animated.View style={[styles.textContainer, textStyle]}>
        <Text
          style={[
            styles.stepText,
            step.isLocked
              ? styles.textLocked
              : step.isCompleted
                ? styles.textCompleted
                : styles.textActive,
          ]}
        >
          {step.text}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = {
  container: {
    marginBottom: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    borderRadius: 8,
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 56,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#ffffff',
  },
  textContainer: {
    flex: 1,
  },
  stepText: {
    fontSize: 16,
  },
  textLocked: {
    color: '#374151',
  },
  textCompleted: {
    color: '#6b7280',
    textDecorationLine: 'line-through' as const,
  },
  textActive: {
    color: '#ffffff',
  },
};
