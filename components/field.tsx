import React, { useMemo } from 'react';
import type { ViewProps } from 'react-native';
import { View, StyleSheet } from 'react-native';
import type { TextProps } from './text';
import { Text } from './text';
import { colors } from '@/helpers/colors';

export const FieldSet = ({ style, ...props }: ViewProps) => (
  <View style={[styles.set, style]} {...props} />
);

export const FieldTitle = ({
  style,
  ...props
}: Omit<TextProps, 'color' | 'weight' | 'colorSubtone'>) => (
  <Text color="white" weight="500" style={[styles.title, style]} {...props} />
);

export const FieldGroup = ({ style, ...props }: ViewProps) => (
  <View style={[styles.group, style]} {...props} />
);

export const Field = ({ style, ...props }: ViewProps) => (
  <View style={[styles.field, style]} {...props} />
);

export const FieldContent = ({ style, ...props }: ViewProps) => (
  <View style={[styles.content, style]} {...props} />
);

export const FieldLabel = ({
  style,
  ...props
}: Omit<TextProps, 'color' | 'weight' | 'colorSubtone'>) => (
  <Text colorSubtone="200" style={[styles.label, style]} {...props} />
);

export const FieldDescription = ({
  style,
  ...props
}: Omit<TextProps, 'color' | 'weight' | 'colorSubtone'>) => (
  <Text size={12} style={[styles.description, style]} {...props} />
);

export const FieldSeparator = ({
  style,
  ...props
}: Omit<ViewProps, 'children'>) => (
  <View style={[styles.separator, style]} {...props}>
    <View style={styles.separatorLine} />
  </View>
);

export const FieldError = ({
  style,
  children,
  errors,
  ...props
}: ViewProps & { errors?: ({ message?: string } | undefined)[] }) => {
  const content = useMemo(() => {
    if (children) {
      return children;
    }
    if (!errors?.length) {
      return null;
    }

    const uniqueErrors = [
      ...new Map(errors.map((error) => [error?.message, error])).values(),
    ];

    if (uniqueErrors?.length === 1) {
      return <Text style={styles.errorText}>{uniqueErrors[0]?.message}</Text>;
    }

    return (
      <View style={styles.errorList}>
        {uniqueErrors.map((error) =>
          error?.message ? (
            <Text key={error.message} style={styles.errorListItem}>
              {'\u2022'} {error.message}
            </Text>
          ) : null
        )}
      </View>
    );
  }, [children, errors]);

  if (!content) {
    return null;
  }

  return (
    <View style={[styles.errorContainer, style]} {...props}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  content: {
    gap: 2,
  },
  description: {
    color: colors.neutral[500],
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    paddingHorizontal: 8,
    textAlign: 'left',
  },
  errorContainer: {
    paddingHorizontal: 8,
  },
  errorList: {
    flexDirection: 'column',
    gap: 4,
    marginLeft: 16,
  },
  errorListItem: {
    color: colors.red,
    fontSize: 14,
  },
  errorText: {
    color: colors.red,
    fontSize: 14,
    fontWeight: '600',
  },
  field: {
    gap: 8,
  },
  group: {
    gap: 20,
  },
  label: {
    paddingHorizontal: 8,
  },
  separator: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  separatorLine: {
    backgroundColor: colors.neutral[700],
    height: 1,
    position: 'absolute',
    top: '50%',
    width: '100%',
  },
  set: {
    gap: 16,
  },
  title: {},
});
