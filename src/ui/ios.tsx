import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from './theme';

export function Screen({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: 32 }}>
      {children}
    </ScrollView>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginTop: 22, marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, overflow: 'hidden' }}>
      <Text style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, color: colors.ink, fontSize: 17, fontWeight: '700' }}>{title}</Text>
      {children}
    </View>
  );
}

export function Row({ title, detail, last }: { title: string; detail?: string | null; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: colors.line }}>
      <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '600' }}>{title}</Text>
      {detail ? <Text style={{ color: colors.muted, fontSize: 15, marginTop: 4 }}>{detail}</Text> : null}
    </View>
  );
}

export function titleCase(label: string) {
  return label.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  chevron,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  chevron?: 'next';
}) {
  const { colors } = useTheme();
  const text = chevron === 'next' ? `${titleCase(label)}  ›` : titleCase(label);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        marginHorizontal: 16,
        marginTop: 16,
        minHeight: 50,
        borderRadius: 12,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ color: colors.accentText, fontSize: 17, fontWeight: '700' }}>{text}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, chevron }: { label: string; onPress: () => void; chevron?: 'back' }) {
  const { colors } = useTheme();
  const text = chevron === 'back' ? `‹  ${titleCase(label)}` : titleCase(label);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        marginHorizontal: 16,
        marginTop: 10,
        minHeight: 50,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: colors.navy,
        backgroundColor: colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={{ color: colors.navy, fontSize: 17, fontWeight: '700' }}>{text}</Text>
    </Pressable>
  );
}

export function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ marginHorizontal: 16, marginTop: 12, minHeight: 44, justifyContent: 'center' }}>
      <Text style={{ color: colors.navy, fontSize: 16, fontWeight: '700' }}>{titleCase(label)}</Text>
    </Pressable>
  );
}

export function ConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  children,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <View style={{ flex: 1, backgroundColor: 'rgba(11,23,51,0.72)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, paddingBottom: 8 }}>
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '700', paddingHorizontal: 16, paddingTop: 18 }}>{title}</Text>
          <Text style={{ color: colors.muted, fontSize: 16, lineHeight: 22, paddingHorizontal: 16, marginTop: 8 }}>{body}</Text>
          {children}
          <PrimaryButton label={confirmLabel} onPress={onConfirm} />
          <SecondaryButton label="Cancel" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

export function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        marginHorizontal: 16,
        marginTop: 8,
        minHeight: 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: selected ? colors.navy : colors.line,
        backgroundColor: selected ? colors.fill : colors.card,
        justifyContent: 'center',
        paddingHorizontal: 16,
      }}
    >
      <Text style={{ color: selected ? colors.navy : colors.ink, fontSize: 16, fontWeight: selected ? '700' : '400' }}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  value,
  onChangeText,
  placeholder,
  multiline,
  autoCapitalize = 'none',
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      autoCapitalize={autoCapitalize}
      multiline={multiline}
      style={{
        marginHorizontal: 16,
        marginTop: 8,
        minHeight: multiline ? 96 : 48,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.line,
        backgroundColor: colors.fill,
        paddingHorizontal: 14,
        paddingTop: multiline ? 12 : 0,
        fontSize: 16,
        color: colors.ink,
        textAlignVertical: multiline ? 'top' : 'center',
      }}
    />
  );
}

export function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  function choose(next: T) {
    onChange(next);
    setOpen(false);
  }

  function openMenu() {
    setOpen(true);
  }

  return (
    <View style={{ marginHorizontal: 16, marginTop: 8 }}>
      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>{label}</Text>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={openMenu}
        style={{
          minHeight: 48,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.fill,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text style={{ color: selected ? colors.ink : colors.muted, fontSize: 16, flex: 1 }}>{selected?.label ?? 'Select'}</Text>
        <Text style={{ color: colors.muted, fontSize: 16 }}>▾</Text>
      </Pressable>
      {open ? (
        <View style={{ marginTop: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: 'hidden' }}>
          {options.map((option) => {
            const on = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: on }}
                onPress={() => choose(option.value)}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.line,
                  backgroundColor: on ? colors.fill : colors.card,
                }}
              >
                <Text style={{ color: on ? colors.accent : colors.ink, fontSize: 16, fontWeight: on ? '700' : '400', flex: 1 }}>{option.label}</Text>
                {on ? <Text style={{ color: colors.accent, fontSize: 16, fontWeight: '700' }}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function WarningBanner({ children }: { children: string }) {
  const { colors, dark } = useTheme();
  const background = dark ? colors.gold : '#FFF1D2';
  const text = dark ? colors.onAccent : '#3D2B00';
  return (
    <View
      accessibilityRole="alert"
      style={{
        marginHorizontal: 16,
        marginTop: 12,
        backgroundColor: background,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.gold,
        padding: 14,
      }}
    >
      <Text style={{ color: text, fontSize: 15, fontWeight: '700', lineHeight: 21 }}>{children}</Text>
    </View>
  );
}

export function Note({ children }: { children: string }) {
  const { colors } = useTheme();
  return <Text style={{ marginHorizontal: 20, marginTop: 12, color: colors.muted, fontSize: 16, lineHeight: 22 }}>{children}</Text>;
}

export function InfoTip({ label = 'More information', children, inline }: { label?: string; children: string; inline?: boolean }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={inline ? { flexShrink: 1 } : { marginHorizontal: 16, marginTop: 12 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        hitSlop={8}
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: colors.navy,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.navy, fontSize: 15, fontWeight: '700' }}>i</Text>
      </Pressable>
      {open ? <Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21, marginTop: 8 }}>{children}</Text> : null}
    </View>
  );
}
