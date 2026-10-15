import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useAccountability } from '../../src/app/state/AccountabilityProvider';
import { CRISIS_LINE, SAPR_LINE, SELF_HELP_LABEL, summarizeSelfHelp } from '../../src/domain/help';
import { displayName } from '../../src/domain/labels';
import type { HelpSubject, SelfHelpKind } from '../../src/domain/types';
import { Choice, Dropdown, Field, Note, PrimaryButton, Screen, SecondaryButton, WarningBanner } from '../../src/ui/ios';
import { useTheme } from '../../src/ui/theme';
import { ResourceCard } from '../../src/ui/wizards';

const subjects: { value: HelpSubject; label: string }[] = [
  { value: 'MYSELF', label: 'Myself' },
  { value: 'SHIPMATE', label: 'A shipmate' },
  { value: 'BOTH', label: 'Myself and a shipmate' },
];

const rideWhen = ['Right now', 'Within 30 minutes'].map((value) => ({ value, label: value }));
const medicalOptions = ['Needs a ride to care', 'Needs a check-in'].map((value) => ({ value, label: value }));

export default function HelpScreen() {
  const api = useAccountability();
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const [subject, setSubject] = useState<HelpSubject>('MYSELF');
  const [shipmateId, setShipmateId] = useState<string | null>(null);
  const [shipmateName, setShipmateName] = useState('');
  const [kind, setKind] = useState<SelfHelpKind>('CRISIS');
  const [detail, setDetail] = useState('Right now');
  const [other, setOther] = useState('');
  const [notify, setNotify] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!api.sailor) return null;

  const shipmates = api.state.sailors.filter((sailor) => sailor.commandId === api.sailor?.commandId && sailor.id !== api.sailor?.id);
  const shipmate = shipmates.find((sailor) => sailor.id === shipmateId) ?? null;
  const needsShipmate = subject !== 'MYSELF';
  const kinds = (Object.keys(SELF_HELP_LABEL) as SelfHelpKind[]).filter((value) => needsShipmate || value !== 'UNABLE_TO_REACH');
  const quiet = kind === 'CRISIS' || kind === 'SAPR';
  const summaryDetail = kind === 'OTHER' ? other : detail;
  const namedShipmate = shipmateName.trim() || (shipmate ? displayName(shipmate) : null);
  const summary = summarizeSelfHelp({
    kind,
    detail: quiet ? '' : summaryDetail,
    notifySupervisor: notify,
    subject,
    shipmateName: namedShipmate,
  });

  function chooseKind(next: SelfHelpKind) {
    setKind(next);
    setNotify(false);
    if (next === 'RIDE') setDetail('Right now');
    if (next === 'MEDICAL') setDetail('Needs a ride to care');
  }

  return (
    <Screen>
      {needsShipmate && step >= 1 ? (
        <WarningBanner>
          Call 911 if somebody is in imminent threat of harm or has been injured. Report to the command after the proper authorities have been notified.
        </WarningBanner>
      ) : null}
      {step === 0 ? (
        <>
          <Note>This is for an emergency. A routine late muster stays on the Muster screen.</Note>
          {subjects.map((option) => (
            <Choice key={option.value} label={option.label} selected={subject === option.value} onPress={() => setSubject(option.value)} />
          ))}
          <PrimaryButton label="Next" chevron="next" onPress={() => setStep(needsShipmate ? 1 : 2)} />
        </>
      ) : null}
      {step === 1 ? (
        <>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: '600', marginHorizontal: 16, marginTop: 12 }}>Shipmate name</Text>
          <Field
            value={shipmateName}
            onChangeText={setShipmateName}
            placeholder="Rank and name"
            autoCapitalize="words"
          />
          <Dropdown
            label="Or choose a shipmate"
            value={shipmateId ?? ''}
            options={shipmates.map((sailor) => ({ value: sailor.id, label: displayName(sailor) }))}
            onChange={setShipmateId}
          />
          <Note>Type a name, choose a shipmate from your command, or both.</Note>
          {message ? <Note>{message}</Note> : null}
          <PrimaryButton
            label="Next"
            chevron="next"
            onPress={() => {
              if (!shipmate && shipmateName.trim().length < 2) {
                setMessage('Enter a shipmate or choose one from your command.');
                return;
              }
              setMessage(null);
              setStep(2);
            }}
          />
          <SecondaryButton label="Back" chevron="back" onPress={() => setStep(0)} />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Note>Crisis and SAPR resources open directly. They do not ask what happened.</Note>
          {kinds.map((value) => (
            <Choice key={value} label={SELF_HELP_LABEL[value]} selected={kind === value} onPress={() => chooseKind(value)} />
          ))}
          <PrimaryButton label="Next" chevron="next" onPress={() => setStep(3)} />
          <SecondaryButton label="Back" chevron="back" onPress={() => setStep(needsShipmate ? 1 : 0)} />
        </>
      ) : null}
      {step === 3 ? (
        <>
          {kind === 'RIDE' ? <Dropdown label="When is the ride needed?" value={detail} options={rideWhen} onChange={setDetail} /> : null}
          {kind === 'MEDICAL' ? <Dropdown label="What help is needed?" value={detail} options={medicalOptions} onChange={setDetail} /> : null}
          {kind === 'OTHER' ? <Field value={other} onChangeText={setOther} placeholder="What help is needed?" multiline /> : null}
          {kind === 'CRISIS' ? <ResourceCard name={CRISIS_LINE.name} phoneLabel={CRISIS_LINE.phoneLabel} phone={CRISIS_LINE.phone} url={CRISIS_LINE.url} /> : null}
          {kind === 'SAPR' ? <ResourceCard name={SAPR_LINE.name} phoneLabel={SAPR_LINE.phoneLabel} phone={SAPR_LINE.phone} url={SAPR_LINE.url} /> : null}
          {quiet ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 }}>
              <Text style={{ color: colors.ink, fontSize: 16, flex: 1 }}>Ask my supervisor to contact me</Text>
              <Switch accessibilityLabel="Ask my supervisor to contact me" value={notify} onValueChange={setNotify} trackColor={{ false: colors.line, true: colors.green }} />
            </View>
          ) : null}
          <PrimaryButton label="Next" chevron="next" onPress={() => setStep(4)} />
          <SecondaryButton label="Back" chevron="back" onPress={() => setStep(2)} />
        </>
      ) : null}
      {step === 4 ? (
        <>
          <Note>{summary}</Note>
          {message ? <Note>{message}</Note> : null}
          <PrimaryButton
            label="Submit"
            onPress={() => {
              const result = api.submitSelfHelp({
                kind,
                detail: quiet ? '' : summaryDetail,
                notifySupervisor: quiet ? notify : true,
                subject,
                shipmateId: needsShipmate ? shipmateId : null,
                shipmateName: needsShipmate ? shipmateName.trim() || null : null,
              });
              setMessage(result.ok ? result.message : result.error);
              if (result.ok) setStep(0);
            }}
          />
          <SecondaryButton label="Back" chevron="back" onPress={() => setStep(3)} />
        </>
      ) : null}
    </Screen>
  );
}
