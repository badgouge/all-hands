import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAccountability } from '../src/app/state/AccountabilityProvider';
import { SNIV_CATEGORY_LABEL } from '../src/domain/labels';
import { addDays, todayInZone } from '../src/domain/time';
import type { SnivCategory, SnivRecurrence } from '../src/domain/types';
import { useTheme } from '../src/ui/theme';
import { Dropdown, Field, PrimaryButton, Screen, Section } from '../src/ui/ios';

const categories = Object.keys(SNIV_CATEGORY_LABEL) as SnivCategory[];
const recurrenceOptions: { value: SnivRecurrence; label: string }[] = [
  { value: 'NONE', label: 'Does not repeat' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKDAYS', label: 'Weekdays' },
  { value: 'WEEKLY', label: 'Weekly' },
];

export default function RequestScreen() {
  const api = useAccountability();
  const router = useRouter();
  const { colors } = useTheme();
  const today = api.sailor ? todayInZone(api.state.command.timezone, new Date()) : '';
  const [category, setCategory] = useState<SnivCategory>('DENTAL');
  const [categoryNote, setCategoryNote] = useState('');
  const [date, setDate] = useState(today ? addDays(today, 1) : '');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [remarks, setRemarks] = useState('');
  const [recurrence, setRecurrence] = useState<SnivRecurrence>('NONE');
  const [untilDate, setUntilDate] = useState(today ? addDays(today, 14) : '');
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <Dropdown
        label="Category"
        value={category}
        options={categories.map((item) => ({ value: item, label: SNIV_CATEGORY_LABEL[item] }))}
        onChange={setCategory}
      />
      {category === 'OTHER' ? <Field value={categoryNote} onChangeText={setCategoryNote} placeholder="Describe the category" /> : null}
      <Section title="When">
        <Field value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" />
        <Field value={startTime} onChangeText={setStartTime} placeholder="Start HH:MM" />
        <Field value={endTime} onChangeText={setEndTime} placeholder="End HH:MM" />
        <Field value={remarks} onChangeText={setRemarks} placeholder="Remarks" multiline />
      </Section>
      <Dropdown label="Repeats" value={recurrence} options={recurrenceOptions} onChange={setRecurrence} />
      {recurrence !== 'NONE' ? <Field value={untilDate} onChangeText={setUntilDate} placeholder="Until YYYY-MM-DD" /> : null}
      {error ? <Text style={{ marginHorizontal: 20, marginTop: 12, color: colors.red, fontSize: 16 }}>{error}</Text> : null}
      <PrimaryButton
        label="Submit"
        onPress={() => {
          const result = api.submitSniv({
            category,
            date,
            endDate: date,
            startTime,
            endTime,
            remarks,
            categoryNote: category === 'OTHER' ? categoryNote : undefined,
            recurrence,
            untilDate: recurrence === 'NONE' ? undefined : untilDate,
          });
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
