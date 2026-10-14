import { Text, StyleSheet } from 'react-native';
import { useAccountability } from '../../src/app/state/AccountabilityProvider';
import { familyCardModel, musterCardModel, snivCardModel } from '../../src/domain/viewModels';
import { formatDateShort, greeting, todayInZone } from '../../src/domain/time';
import { colors } from '../../src/ui/theme';
import { Row, Screen, Section } from '../../src/ui/ios';

export default function HomeScreen() {
  const { state, sailor, settings } = useAccountability();
  if (!sailor) return null;
  const now = new Date();
  const today = todayInZone(state.command.timezone, now);
  const muster = musterCardModel(state, sailor, now, settings.forceDutyDay);
  const family = familyCardModel(state, sailor);
  const sniv = snivCardModel(state, sailor, today);

  return (
    <Screen>
      <Text style={styles.date}>{formatDateShort(today, state.command.timezone)}</Text>
      <Text style={styles.title}>{greeting(now, state.command.timezone)}. Ready to check in?</Text>
      <Text style={styles.command}>{state.command.name}</Text>
      <Section title="Muster">
        <Row title={muster.label} detail={[muster.detail, muster.deadline].filter(Boolean).join(' · ')} last />
      </Section>
      <Section title="Family">
        <Row title={`${family.count} dependents`} detail={family.statusLine} last />
      </Section>
      <Section title="Snivel Log">
        <Row
          title={sniv.next ? sniv.next.label : 'No upcoming absence'}
          detail={sniv.next ? sniv.next.when : `${sniv.pending} pending`}
          last
        />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  date: { marginTop: 16, marginHorizontal: 20, color: colors.muted, fontSize: 15 },
  title: { marginTop: 6, marginHorizontal: 20, color: colors.ink, fontSize: 28, fontWeight: '700' },
  command: { marginTop: 6, marginHorizontal: 20, color: colors.muted, fontSize: 16 },
});
