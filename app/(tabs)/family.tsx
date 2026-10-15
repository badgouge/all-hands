import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useAccountability } from '../../src/app/state/AccountabilityProvider';
import { familyEventFor, listDependents } from '../../src/domain/accountability';
import { FAMILY_STATUS_LABEL, RELATIONSHIP_LABEL } from '../../src/domain/labels';
import type { FamilyStatus, ShareLocation } from '../../src/domain/types';
import { useTheme } from '../../src/ui/theme';
import { Dropdown, Field, InfoTip, Note, PrimaryButton, Row, Screen, Section, TextButton } from '../../src/ui/ios';
import { FamilyHelpWizard } from '../../src/ui/wizards';

type Reportable = Exclude<FamilyStatus, 'NOT_REPORTED'>;

const statusOptions = (Object.keys(FAMILY_STATUS_LABEL) as Reportable[]).map((value) => ({
  value,
  label: FAMILY_STATUS_LABEL[value],
}));

export default function FamilyScreen() {
  const api = useAccountability();
  const { colors } = useTheme();
  const [editing, setEditing] = useState<string | null>(null);
  const [editingHome, setEditingHome] = useState(false);
  const [phones, setPhones] = useState<Record<string, string>>({});
  const [addresses, setAddresses] = useState<Record<string, string>>({});
  const [homePhone, setHomePhone] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [statuses, setStatuses] = useState<Record<string, Reportable>>({});
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [helpOpen, setHelpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!api.sailor) return null;

  const listed = listDependents(api.state, api.sailor, api.sailor.id);
  const event = familyEventFor(api.state, api.sailor.id);
  const people = listed.ok ? listed.value : [];
  const household = (api.state.households ?? []).find((item) => item.sponsorId === api.sailor?.id);
  const share = household?.shareLocation ?? 'OWN';
  const accounted = people.length > 0 && people.every((person) => person.currentStatus === 'SAFE');
  const sailorPhone = editingHome ? homePhone : (household?.phone ?? '');
  const sailorAddress = editingHome ? homeAddress : (household?.address ?? '');

  function chooseShare(mode: ShareLocation) {
    const next = share === mode ? 'OWN' : mode;
    const result = api.setShareLocation(next);
    if (!result.ok) setError(result.error);
    else setError(null);
  }

  return (
    <View style={{ flex: 1 }}>
    <Screen>
      {event?.origin === 'COMMAND' ? (
        <InfoTip>The Navy opened accountability for the command. Report each dependent, or account for the whole family.</InfoTip>
      ) : null}
      {event?.origin === 'SAILOR' ? (
        <InfoTip>You opened a request for help. Report each dependent, or account for the whole family.</InfoTip>
      ) : null}
      {!event ? <InfoTip>Request help if you need to account for your dependents, or wait for the Navy to open accountability.</InfoTip> : null}
      <PrimaryButton label="Request Help for My Family" onPress={() => setHelpOpen(true)} />

      <View style={{ marginHorizontal: 16, marginTop: 18, backgroundColor: colors.card, borderRadius: 12, paddingBottom: 8 }}>
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '700', paddingHorizontal: 16, paddingTop: 14 }}>Your household</Text>
        {editingHome ? (
          <>
            <Field value={sailorPhone} onChangeText={setHomePhone} placeholder="Phone" />
            <Field value={sailorAddress} onChangeText={setHomeAddress} placeholder="Street address" />
            <PrimaryButton
              label="Save Contact"
              onPress={() => {
                const result = api.updateHousehold(sailorPhone, sailorAddress);
                if (!result.ok) setError(result.error);
                else setEditingHome(false);
              }}
            />
            <TextButton label="Cancel" onPress={() => setEditingHome(false)} />
          </>
        ) : (
          <>
            <Text style={{ color: colors.ink, fontSize: 16, paddingHorizontal: 16, marginTop: 8 }}>{household?.phone || 'No phone on file'}</Text>
            <Text style={{ color: colors.muted, fontSize: 15, paddingHorizontal: 16, marginTop: 4 }}>{household?.address || 'No address on file'}</Text>
            <TextButton
              label="Edit Contact"
              onPress={() => {
                setHomePhone(household?.phone ?? '');
                setHomeAddress(household?.address ?? '');
                setEditingHome(true);
              }}
            />
          </>
        )}
      </View>

      <Section title="Bulk actions">
        <ShareRow label="My Dependents Live with Me" value={share === 'SAILOR'} onChange={() => chooseShare('SAILOR')} />
        <ShareRow label="My Dependents Live with My Spouse" value={share === 'SPOUSE'} onChange={() => chooseShare('SPOUSE')} />
        <ShareRow
          label="Family accounted for"
          value={accounted}
          onChange={(on) => {
            const result = api.accountForFamily(on);
            if (!result.ok) setError(result.error);
          }}
        />
      </Section>

      {!listed.ok ? (
        <Section title="Dependents">
          <Row title="Unavailable" detail={listed.error} last />
        </Section>
      ) : people.length === 0 ? (
        <Section title="Dependents">
          <Row title="No dependents are registered." last />
        </Section>
      ) : (
        people.map((person) => {
          const status = statuses[person.id] ?? person.currentStatus ?? 'UNKNOWN';
          const needsArea = status === 'DISPLACED' || status === 'NEEDS_ASSISTANCE';
          const phone = phones[person.id] ?? person.phone ?? '';
          const address = addresses[person.id] ?? person.address ?? person.contactSummary;
          const open = editing === person.id;
          return (
            <View key={person.id} style={{ marginTop: 18, marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, paddingBottom: 8 }}>
              <Text style={{ marginHorizontal: 16, marginTop: 14, color: colors.muted, fontSize: 13, fontWeight: '600' }}>
                {RELATIONSHIP_LABEL[person.relationship].toUpperCase()}
              </Text>
              <Text style={{ color: colors.ink, fontSize: 20, fontWeight: '700', paddingHorizontal: 16, marginTop: 4 }}>
                {person.firstName} {person.lastName}
              </Text>
              <Text style={{ color: colors.muted, fontSize: 15, paddingHorizontal: 16, marginTop: 4 }}>
                Current status: {person.currentStatus ? FAMILY_STATUS_LABEL[person.currentStatus] : 'Not reported'}
              </Text>
              {open ? (
                <>
                  <Field value={phone} onChangeText={(value) => setPhones((current) => ({ ...current, [person.id]: value }))} placeholder="Phone" />
                  <Field value={address} onChangeText={(value) => setAddresses((current) => ({ ...current, [person.id]: value }))} placeholder="Street address" />
                  <PrimaryButton
                    label="Save Contact"
                    onPress={() => {
                      const result = api.updateDependentContact(person.id, phone, address);
                      if (!result.ok) setError(result.error);
                      else setEditing(null);
                    }}
                  />
                  <TextButton label="Cancel" onPress={() => setEditing(null)} />
                </>
              ) : (
                <>
                  <Text style={{ color: colors.ink, fontSize: 16, paddingHorizontal: 16, marginTop: 10 }}>{person.phone || 'No phone on file'}</Text>
                  <Text style={{ color: colors.muted, fontSize: 15, paddingHorizontal: 16, marginTop: 4 }}>{person.address || 'No address on file'}</Text>
                  <TextButton
                    label="Edit Contact"
                    onPress={() => {
                      setPhones((current) => ({ ...current, [person.id]: person.phone ?? '' }));
                      setAddresses((current) => ({ ...current, [person.id]: person.address ?? '' }));
                      setEditing(person.id);
                    }}
                  />
                </>
              )}
              {event ? (
                <>
                  <Dropdown
                    label="Status"
                    value={status}
                    options={statusOptions}
                    onChange={(value) => setStatuses((current) => ({ ...current, [person.id]: value }))}
                  />
                  <Field
                    value={locations[person.id] ?? person.address ?? ''}
                    onChangeText={(value) => setLocations((current) => ({ ...current, [person.id]: value }))}
                    placeholder={needsArea ? 'Address or general area' : 'Address'}
                  />
                  <Field
                    value={remarks[person.id] ?? ''}
                    onChangeText={(value) => setRemarks((current) => ({ ...current, [person.id]: value }))}
                    placeholder="Remarks for the command"
                    multiline
                  />
                  <PrimaryButton
                    label="Submit Individual Status"
                    onPress={() => {
                      const result = api.submitDependentStatus(
                        person.id,
                        status,
                        locations[person.id] ?? person.address ?? '',
                        remarks[person.id] ?? '',
                      );
                      if (!result.ok) setError(result.error);
                    }}
                  />
                </>
              ) : null}
            </View>
          );
        })
      )}
      {error ? <Note>{error}</Note> : null}
    </Screen>
      {helpOpen ? (
        <FamilyHelpWizard
          people={people.map((person) => ({ id: person.id, name: `${person.firstName} ${person.lastName}` }))}
          location={household?.address ?? ''}
          onClose={() => setHelpOpen(false)}
          onSubmit={(input) => {
            const result = api.submitFamilyHelp(input);
            setHelpOpen(false);
            if (!result.ok) setError(result.error);
          }}
        />
      ) : null}
    </View>
  );
}

function ShareRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 }}>
      <Text style={{ color: colors.ink, fontSize: 16, flex: 1 }}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ false: colors.line, true: colors.green }} />
    </View>
  );
}
