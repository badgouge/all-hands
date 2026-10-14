import { useState } from 'react';
import { Text, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAccountability } from '../src/app/state/AccountabilityProvider';
import { SNIV_CATEGORY_LABEL } from '../src/domain/labels';
import { addDays, todayInZone } from '../src/domain/time';
import type { SnivCategory } from '../src/domain/types';
import { Choice, PrimaryButton, Screen, Section } from '../src/ui/ios';
import { colors } from '../src/ui/theme';

const categories = Object.keys(SNIV_CATEGORY_LABEL) as SnivCategory[];

export default function RequestScreen() {
  const api = useAccountability();
  const router = useRouter();
  const today = api.sailor ? todayInZone(api.state.command.timezone, new Date()) : '';
  const [category, setCategory] = useState<SnivCategory>('DENTAL');
  const [date, setDate] = useState(today ? addDays(today, 1) : '');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <Section title="Category">
        {categories.map((item) => (
          <Choice key={item} label={SNIV_CATEGORY_LABEL[item]} selected={category === item} onPress={() => setCategory(item)} />
        ))}
      </Section>
      <Section title="When">
        <TextInput style={styles.input} value={date} onChangeText={setDate} autoCapitalize="none" placeholder="YYYY-MM-DD" />
        <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} autoCapitalize="none" placeholder="Start HH:MM" />
        <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} autoCapitalize="none" placeholder="End HH:MM" />
        <TextInput style={[styles.input, styles.notes]} value={remarks} onChangeText={setRemarks} placeholder="Remarks" multiline />
      </Section>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton
        label="Submit request"
        onPress={() => {
          const result = api.submitSniv({ category, date, endDate: date, startTime, endTime, remarks });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { marginHorizontal: 16, marginTop: 8, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: 14, fontSize: 16, color: colors.ink },
  notes: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  error: { marginHorizontal: 20, marginTop: 12, color: colors.red, fontSize: 16 },
});
