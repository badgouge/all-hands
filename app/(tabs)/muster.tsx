import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAccountability } from '../../src/app/state/AccountabilityProvider';
import { currentMuster, periodForDate } from '../../src/domain/accountability';
import { LATE_REASON_LABEL } from '../../src/domain/help';
import { musterCardModel, type MusterCardModel } from '../../src/domain/viewModels';
import { MUSTER_STATUS_LABEL, MUSTER_STATUS_SHORT } from '../../src/domain/labels';
import { formatDateLong, formatMilitary, todayInZone } from '../../src/domain/time';
import type { LateReason, MusterStatus } from '../../src/domain/types';
import { useTheme } from '../../src/ui/theme';
import { Dropdown, Field, InfoTip, Note, PrimaryButton, Row, Screen, Section } from '../../src/ui/ios';

const options = (Object.keys(MUSTER_STATUS_LABEL) as MusterStatus[]).map((value) => ({
  value,
  label: MUSTER_STATUS_LABEL[value],
}));

const lateOptions = (Object.keys(LATE_REASON_LABEL) as LateReason[]).map((value) => ({
  value,
  label: LATE_REASON_LABEL[value],
}));

export default function MusterScreen() {
  const api = useAccountability();
  const router = useRouter();
  const { colors } = useTheme();
  const [status, setStatus] = useState<MusterStatus>('PRESENT');
  const [runningLate, setRunningLate] = useState(false);
  const [lateReason, setLateReason] = useState<LateReason>('CAR_TROUBLE');
  const [lateNote, setLateNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  if (!api.sailor) return null;

  const now = new Date();
  const today = todayInZone(api.state.command.timezone, now);
  const period = periodForDate(api.state, today);
  const record = currentMuster(api.state, api.sailor.id, today);
  const muster = musterCardModel(api.state, api.sailor, now, api.settings.forceDutyDay);
  const musterBy = formatMilitary(api.state.command.musterPolicy.primaryWindowEnd);
  const canReport = Boolean(period?.required) && !record && (muster.phase === 'PRIMARY' || muster.phase === 'LATE');
  const pill = pillFor(muster, colors);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginHorizontal: 20, marginTop: 20, gap: 12 }}>
          <Text style={{ flex: 1, color: colors.ink, fontSize: 34, fontWeight: '700', lineHeight: 40 }}>
            {formatDateLong(today, api.state.command.timezone)}
          </Text>
          <View style={{ backgroundColor: pill.background, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, marginTop: 8 }}>
            <Text style={{ color: pill.color, fontSize: 13, fontWeight: '700' }}>{pill.label}</Text>
          </View>
        </View>
        <Text style={{ marginHorizontal: 20, marginTop: 6, color: colors.muted, fontSize: 17, fontWeight: '600' }}>Muster by {musterBy}</Text>
        <InfoTip>A muster is required every 24 hours. Weekends and holidays are not required unless your supervisor includes them.</InfoTip>
        <Section title="Today">
          <Row title={record ? MUSTER_STATUS_SHORT[record.status] : muster.label} detail={muster.detail} last />
        </Section>
        {record ? <Note>This muster is recorded and cannot be changed.</Note> : null}
        {!period?.required ? <Note>{muster.detail}</Note> : null}
        {canReport ? (
          <>
            <Dropdown label="Report status" value={status} options={options} onChange={setStatus} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 16 }}>
              <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '600' }}>I'm late</Text>
              <Switch
                accessibilityLabel="I'm late"
                value={runningLate}
                onValueChange={setRunningLate}
                trackColor={{ false: colors.line, true: colors.green }}
              />
            </View>
            {runningLate ? (
              <>
                <Dropdown label="Why are you late?" value={lateReason} options={lateOptions} onChange={setLateReason} />
                {lateReason === 'OTHER' ? <Field value={lateNote} onChangeText={setLateNote} placeholder="Routine reason" /> : null}
              </>
            ) : null}
            <PrimaryButton
              label="Submit"
              onPress={() => {
                const result = api.submitMuster(status, runningLate ? { reason: lateReason, note: lateNote } : null);
                setMessage(result.ok ? result.message : result.error);
              }}
            />
          </>
        ) : null}
        {message ? <Text style={{ margin: 20, color: colors.ink, fontSize: 16, lineHeight: 22 }}>{message}</Text> : null}
        <PrimaryButton label="Muster history" onPress={() => router.push('/history')} />
      </Screen>
    </View>
  );
}

function pillFor(muster: MusterCardModel, colors: { gold: string; green: string; blue: string; ink: string; muted: string; fill: string; onAccent: string }) {
  if (muster.state === 'MUSTERED' || muster.state === 'EXCUSED') {
    return { label: muster.state === 'EXCUSED' ? 'Excused' : 'Confirmed', background: colors.green, color: colors.onAccent };
  }
  if (muster.state === 'AWAITING_VERIFICATION') return { label: 'Awaiting Verification', background: colors.blue, color: colors.onAccent };
  if (muster.state === 'NOT_REQUIRED') return { label: 'Not Required', background: colors.fill, color: colors.muted };
  if (muster.state === 'SAVED_ON_DEVICE') return { label: 'Saved On Device', background: colors.gold, color: colors.onAccent };
  if (muster.state === 'ACTION_REQUIRED') return { label: 'Needs Attention', background: colors.gold, color: colors.onAccent };
  if (muster.state === 'WINDOW_CLOSED') return { label: 'Window Closed', background: colors.fill, color: colors.ink };
  return { label: 'Not Mustered', background: colors.gold, color: colors.onAccent };
}
