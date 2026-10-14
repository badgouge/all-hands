import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAccountability } from '../../src/app/state/AccountabilityProvider';
import { musterCardModel } from '../../src/domain/viewModels';
import { MUSTER_STATUS_LABEL } from '../../src/domain/labels';
import type { MusterStatus } from '../../src/domain/types';
import { Choice, PrimaryButton, Row, Screen, Section } from '../../src/ui/ios';
import { colors } from '../../src/ui/theme';

const choices: MusterStatus[] = ['PRESENT', 'TELEWORK', 'SICK', 'UNABLE_TO_REPORT'];

export default function MusterScreen() {
  const api = useAccountability();
  const router = useRouter();
  const [status, setStatus] = useState<MusterStatus>('PRESENT');
  const [message, setMessage] = useState<string | null>(null);
  if (!api.sailor) return null;
  const muster = musterCardModel(api.state, api.sailor, new Date(), api.settings.forceDutyDay);

  return (
    <Screen>
      <Section title="Today">
        <Row title={muster.label} detail={muster.detail} />
        <Row title="Last muster" detail={muster.lastReported ?? 'None on this device'} last />
      </Section>
      {muster.canSubmit ? (
        <>
          <Section title="Report status">
            {choices.map((choice, index) => (
              <Choice key={choice} label={MUSTER_STATUS_LABEL[choice]} selected={status === choice} onPress={() => setStatus(choice)} />
            ))}
          </Section>
          <PrimaryButton
            label={muster.actionLabel}
            onPress={() => {
              const result = api.submitMuster(status);
              setMessage(result.ok ? result.message : result.error);
            }}
          />
        </>
      ) : null}
      {message ? <Text style={{ margin: 20, color: colors.ink, fontSize: 16 }}>{message}</Text> : null}
      <PrimaryButton label="Muster history" onPress={() => router.push('/history')} />
    </Screen>
  );
}
