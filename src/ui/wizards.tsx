import { useState, type ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { FAMILY_HELP_LABEL, summarizeFamilyHelp } from '../domain/help';
import type { FamilyHelpKind } from '../domain/types';
import { Choice, Dropdown, Field, Note, PrimaryButton, SecondaryButton } from './ios';
import { useTheme } from './theme';

const familyKinds = (Object.keys(FAMILY_HELP_LABEL) as FamilyHelpKind[]).map((value) => ({ value, label: FAMILY_HELP_LABEL[value] }));

export function FamilyHelpWizard({
  people,
  location,
  onClose,
  onSubmit,
}: {
  people: { id: string; name: string }[];
  location: string;
  onClose: () => void;
  onSubmit: (input: { dependentIds: string[]; kind: FamilyHelpKind; location: string; remarks: string }) => void;
}) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string[]>(people.map((person) => person.id));
  const [kind, setKind] = useState<FamilyHelpKind>('SHELTER');
  const [place, setPlace] = useState(location);
  const [remarks, setRemarks] = useState('');
  const names = people.filter((person) => selected.includes(person.id)).map((person) => person.name);
  const summary = summarizeFamilyHelp(kind, names, place, remarks);

  return (
    <Sheet title="Request Help for My Family" step={step} onClose={onClose}>
      {step === 0 ? (
        <>
          <Note>Choose who this request covers.</Note>
          {people.map((person) => (
            <Choice
              key={person.id}
              label={person.name}
              selected={selected.includes(person.id)}
              onPress={() =>
                setSelected((current) => (current.includes(person.id) ? current.filter((id) => id !== person.id) : [...current, person.id]))
              }
            />
          ))}
          <PrimaryButton label="Next" chevron="next" onPress={() => setStep(1)} />
        </>
      ) : null}
      {step === 1 ? (
        <>
          <Dropdown label="What kind of help?" value={kind} options={familyKinds} onChange={setKind} />
          <PrimaryButton label="Next" chevron="next" onPress={() => setStep(2)} />
          <SecondaryButton label="Back" chevron="back" onPress={() => setStep(0)} />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Field value={place} onChangeText={setPlace} placeholder="Where they are" />
          <Field value={remarks} onChangeText={setRemarks} placeholder="Remarks for the command" multiline />
          <PrimaryButton label="Next" chevron="next" onPress={() => setStep(3)} />
          <SecondaryButton label="Back" chevron="back" onPress={() => setStep(1)} />
        </>
      ) : null}
      {step === 3 ? (
        <>
          <Note>{summary}</Note>
          <PrimaryButton label="Submit" onPress={() => onSubmit({ dependentIds: selected, kind, location: place, remarks })} />
          <SecondaryButton label="Back" chevron="back" onPress={() => setStep(2)} />
        </>
      ) : null}
    </Sheet>
  );
}

function Sheet({ title, children, onClose }: { title: string; step: number; children: ReactNode; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.background, zIndex: 30 }}>
      <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '700', marginHorizontal: 20, marginTop: 18 }}>{title}</Text>
      {children}
      <SecondaryButton label="Close" onPress={onClose} />
    </View>
  );
}

export function ResourceCard({ name, phoneLabel, phone, url }: { name: string; phoneLabel: string; phone: string; url: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ marginHorizontal: 16, marginTop: 12, backgroundColor: colors.card, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.line }}>
      <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '700' }}>{name}</Text>
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(phone)} style={{ marginTop: 10 }}>
        <Text style={{ color: colors.navy, fontSize: 16, fontWeight: '700' }}>{phoneLabel}</Text>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(url)} style={{ marginTop: 8 }}>
        <Text style={{ color: colors.navy, fontSize: 16, fontWeight: '700' }}>{url.replace('https://', '')}</Text>
      </Pressable>
    </View>
  );
}
