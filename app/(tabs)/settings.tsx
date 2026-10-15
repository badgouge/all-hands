import { useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { useAccountability } from '../../src/app/state/AccountabilityProvider';
import { rosterScope } from '../../src/domain/accountability';
import { useTheme } from '../../src/ui/theme';
import { Field, Note, PrimaryButton, Screen } from '../../src/ui/ios';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function SettingsScreen() {
  const api = useAccountability();
  const { colors } = useTheme();
  const policy = api.state.command.musterPolicy;
  const [musterBy, setMusterBy] = useState(policy.primaryWindowEnd);
  const [dutyDays, setDutyDays] = useState<number[]>(policy.dutyDays);
  const [holidays, setHolidays] = useState<string[]>(policy.holidays);
  const [holiday, setHoliday] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  if (!api.sailor) return null;
  if (rosterScope(api.sailor) === 'NONE') {
    return (
      <Screen>
        <Note>Switch to Supervisor to manage work center settings.</Note>
      </Screen>
    );
  }

  function toggleDay(day: number) {
    setDutyDays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort()));
  }

  return (
    <Screen>
      <Note>Muster is required every 24 hours on the days you select. Weekends and holidays stay off unless you turn them on.</Note>
      <Text style={{ marginTop: 18, marginHorizontal: 20, color: colors.muted, fontSize: 13, fontWeight: '600' }}>MUSTER BY</Text>
      <Field value={musterBy} onChangeText={setMusterBy} placeholder="HH:MM" />
      <Text style={{ marginTop: 18, marginHorizontal: 20, color: colors.muted, fontSize: 13, fontWeight: '600' }}>REQUIRED DAYS</Text>
      <View style={{ marginHorizontal: 16, marginTop: 8, backgroundColor: colors.card, borderRadius: 12 }}>
        {DAYS.map((label, day) => (
          <View
            key={label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderBottomWidth: day === DAYS.length - 1 ? 0 : 1,
              borderBottomColor: colors.line,
            }}
          >
            <Text style={{ color: colors.ink, fontSize: 17 }}>{label}</Text>
            <Switch
              accessibilityLabel={`${label} requires muster`}
              value={dutyDays.includes(day)}
              onValueChange={() => toggleDay(day)}
              trackColor={{ false: colors.line, true: colors.green }}
            />
          </View>
        ))}
      </View>
      <Text style={{ marginTop: 18, marginHorizontal: 20, color: colors.muted, fontSize: 13, fontWeight: '600' }}>HOLIDAYS</Text>
      <View style={{ marginHorizontal: 16, marginTop: 8, backgroundColor: colors.card, borderRadius: 12 }}>
        {holidays.length === 0 ? <Note>No holidays on the calendar.</Note> : holidays.map((day) => (
          <View key={day} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
            <Text style={{ color: colors.ink, fontSize: 17 }}>{day}</Text>
            <Pressable accessibilityRole="button" onPress={() => setHolidays((current) => current.filter((item) => item !== day))}>
              <Text style={{ color: colors.red, fontWeight: '700' }}>Remove</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <Field value={holiday} onChangeText={setHoliday} placeholder="YYYY-MM-DD" />
      <PrimaryButton
        label="Add holiday"
        onPress={() => {
          const next = holiday.trim();
          if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) {
            setMessage('Enter a holiday as YYYY-MM-DD.');
            return;
          }
          setHolidays((current) => (current.includes(next) ? current : [...current, next].sort()));
          setHoliday('');
          setMessage(null);
        }}
      />
      <PrimaryButton
        label="Save settings"
        onPress={() => {
          const result = api.updateWorkCenterSettings({ musterBy, dutyDays, holidays });
          setMessage(result.ok ? result.message : result.error);
        }}
      />
      {message ? <Note>{message}</Note> : null}
    </Screen>
  );
}
