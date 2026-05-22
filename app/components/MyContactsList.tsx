import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFocusEffect } from '@react-navigation/native';
import { theme } from '@/constants/Colors';
import { apiRequest, ApiError } from '@/lib/api';
import type { Contact } from '@/lib/types';

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  relationship: '',
  isEmergency: false,
  notifyOnHelp: true,
  notifyOnMissed: true,
  notifyOnDecline: false,
};

interface FoundUser {
  id: string;
  fullName: string;
}

interface Props {
  editing: boolean;
}

export function MyContactsList({ editing }: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<Contact[]>('/contacts');
      setContacts(res);
    } catch {
      // Silent
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openAdd = () => {
    setEditingContact(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setFoundUser(null);
    setModalVisible(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setForm({
      name: contact.name,
      phone: contact.phone ?? '',
      email: contact.email ?? '',
      relationship: contact.relationship ?? '',
      isEmergency: contact.isEmergency,
      notifyOnHelp: contact.notifyOnHelp,
      notifyOnMissed: contact.notifyOnMissed,
      notifyOnDecline: contact.notifyOnDecline,
    });
    setFormError('');
    // When editing an existing linked contact, pre-populate foundUser
    setFoundUser(contact.contactUserId ? { id: contact.contactUserId, fullName: contact.name } : null);
    setModalVisible(true);
  };

  const handleLookup = async () => {
    const email = form.email.trim().toLowerCase();
    if (!email) { setFormError('Enter an email address first'); return; }
    setFormError('');
    setFoundUser(null);
    setLookingUp(true);
    try {
      const res = await apiRequest<FoundUser>(`/users/lookup?email=${encodeURIComponent(email)}`);
      setFoundUser(res);
      // Auto-fill name if empty
      if (!form.name) updateField('name', res.fullName);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not look up user');
    } finally {
      setLookingUp(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Name is required'); return; }
    setFormError('');
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        relationship: form.relationship.trim() || undefined,
        isEmergency: form.isEmergency,
        notifyOnHelp: form.notifyOnHelp,
        notifyOnMissed: form.notifyOnMissed,
        notifyOnDecline: form.notifyOnDecline,
      };
      if (editingContact) {
        await apiRequest(`/contacts/${editingContact._id}`, { method: 'PUT', body });
      } else {
        await apiRequest('/contacts', { method: 'POST', body });
      }
      setModalVisible(false);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (contact: Contact) => {
    Alert.alert(
      'Delete Contact',
      `Remove ${contact.name} from your trusted contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiRequest(`/contacts/${contact._id}`, { method: 'DELETE' });
              await load();
            } catch { /* Silent */ }
          },
        },
      ]
    );
  };

  const move = useCallback(async (index: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? index - 1 : index + 1;
    if (toIndex < 0 || toIndex >= contacts.length) return;
    const prev = [...contacts];
    const next = [...contacts];
    const fromSortOrder = next[index].sortOrder;
    const toSortOrder = next[toIndex].sortOrder;
    const updatedFrom = { ...next[index], sortOrder: toSortOrder };
    const updatedTo = { ...next[toIndex], sortOrder: fromSortOrder };
    next[index] = updatedTo;
    next[toIndex] = updatedFrom;
    setContacts(next);
    try {
      await Promise.all([
        apiRequest(`/contacts/${updatedFrom._id}`, { method: 'PUT', body: { sortOrder: updatedFrom.sortOrder } }),
        apiRequest(`/contacts/${updatedTo._id}`, { method: 'PUT', body: { sortOrder: updatedTo.sortOrder } }),
      ]);
    } catch {
      setContacts(prev);
    }
  }, [contacts]);

  const updateField = (key: keyof typeof EMPTY_FORM, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  if (loaded && contacts.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyEmoji}>👨‍👩‍👧‍👦</Text>
        <Text style={styles.emptyTitle}>No contacts yet</Text>
        <Text style={styles.emptySubtext}>
          Add family or trusted people who should be notified about your well-being
        </Text>
        <Pressable style={styles.addFirstBtn} onPress={openAdd}>
          <Text style={styles.addFirstBtnText}>+ Add First Contact</Text>
        </Pressable>
        <ContactModal
          visible={modalVisible}
          editing={editingContact}
          form={form}
          saving={saving}
          lookingUp={lookingUp}
          formError={formError}
          foundUser={foundUser}
          updateField={updateField}
          onLookup={handleLookup}
          onSave={handleSave}
          onClose={() => setModalVisible(false)}
        />
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={contacts}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        renderItem={({ item, index }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  {item.isEmergency && (
                    <View style={styles.emergencyBadge}>
                      <Text style={styles.emergencyText}>Emergency</Text>
                    </View>
                  )}
                  {item.contactUserId && (
                    <View style={styles.sihatyBadge}>
                      <FontAwesome name="check-circle" size={11} color={theme.primary} />
                      <Text style={styles.sihatyBadgeText}>Sihaty</Text>
                    </View>
                  )}
                </View>
                {item.relationship ? <Text style={styles.cardRelationship}>{item.relationship}</Text> : null}
                {item.phone ? <Text style={styles.cardDetail}>{item.phone}</Text> : null}
              </View>
              {editing ? (
                <View style={styles.arrowBtns}>
                  <Pressable
                    style={[styles.arrowBtn, index === 0 && styles.arrowBtnDisabled]}
                    disabled={index === 0}
                    onPress={() => move(index, 'up')}
                    hitSlop={6}>
                    <FontAwesome name="chevron-up" size={13} color={index === 0 ? '#D1D5DB' : theme.textPrimary} />
                  </Pressable>
                  <Pressable
                    style={[styles.arrowBtn, index === contacts.length - 1 && styles.arrowBtnDisabled]}
                    disabled={index === contacts.length - 1}
                    onPress={() => move(index, 'down')}
                    hitSlop={6}>
                    <FontAwesome name="chevron-down" size={13} color={index === contacts.length - 1 ? '#D1D5DB' : theme.textPrimary} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.cardActions}>
                  <Pressable style={styles.actionButton} onPress={() => openEdit(item)} hitSlop={8}>
                    <FontAwesome name="pencil" size={18} color={theme.primary} />
                  </Pressable>
                  <Pressable style={styles.actionButton} onPress={() => handleDelete(item)} hitSlop={8}>
                    <FontAwesome name="trash" size={18} color={theme.danger} />
                  </Pressable>
                </View>
              )}
            </View>
            {!editing && (
              <View style={styles.notifyRow}>
                {item.notifyOnHelp && <View style={styles.notifyChip}><Text style={styles.notifyChipText}>Help</Text></View>}
                {item.notifyOnMissed && <View style={styles.notifyChip}><Text style={styles.notifyChipText}>Missed</Text></View>}
                {item.notifyOnDecline && <View style={styles.notifyChip}><Text style={styles.notifyChipText}>Decline</Text></View>}
              </View>
            )}
          </View>
        )}
        ListFooterComponent={
          !editing ? (
            <Pressable style={styles.addBtn} onPress={openAdd}>
              <FontAwesome name="plus" size={16} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Add Contact</Text>
            </Pressable>
          ) : null
        }
      />
      <ContactModal
        visible={modalVisible}
        editing={editingContact}
        form={form}
        saving={saving}
        lookingUp={lookingUp}
        formError={formError}
        foundUser={foundUser}
        updateField={updateField}
        onLookup={handleLookup}
        onSave={handleSave}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

interface ModalProps {
  visible: boolean;
  editing: Contact | null;
  form: typeof EMPTY_FORM;
  saving: boolean;
  lookingUp: boolean;
  formError: string;
  foundUser: FoundUser | null;
  updateField: (key: keyof typeof EMPTY_FORM, value: string | boolean) => void;
  onLookup: () => void;
  onSave: () => void;
  onClose: () => void;
}

function ContactModal({ visible, editing, form, saving, lookingUp, formError, foundUser, updateField, onLookup, onSave, onClose }: ModalProps) {
  const canSave = !!foundUser;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView style={styles.modalContainer} contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editing ? 'Edit Contact' : 'Add Contact'}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <FontAwesome name="times" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Email lookup — required first step */}
          <Text style={styles.label}>Sihaty account email *</Text>
          <View style={styles.emailRow}>
            <TextInput
              style={[styles.input, styles.emailInput]}
              placeholder="their@email.com"
              placeholderTextColor={theme.textSecondary}
              value={form.email}
              onChangeText={(v) => { updateField('email', v); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!editing}
            />
            {!editing && (
              <Pressable
                style={({ pressed }) => [styles.findBtn, (pressed || lookingUp) && { opacity: 0.8 }]}
                onPress={onLookup}
                disabled={lookingUp}>
                <Text style={styles.findBtnText}>{lookingUp ? '…' : 'Find'}</Text>
              </Pressable>
            )}
          </View>

          {foundUser && (
            <View style={styles.foundBanner}>
              <FontAwesome name="check-circle" size={16} color={theme.primary} />
              <Text style={styles.foundText}>{foundUser.fullName} — Sihaty user found ✓</Text>
            </View>
          )}

          {formError ? <Text style={styles.formError}>{formError}</Text> : null}

          {/* Rest of form — only shown once user is found or editing */}
          {(foundUser || editing) && (
            <>
              <Text style={styles.label}>Name</Text>
              <TextInput style={styles.input} placeholder="Display name" placeholderTextColor={theme.textSecondary} value={form.name} onChangeText={(v) => updateField('name', v)} autoComplete="name" />

              <Text style={styles.label}>Phone</Text>
              <TextInput style={styles.input} placeholder="Phone number (optional)" placeholderTextColor={theme.textSecondary} value={form.phone} onChangeText={(v) => updateField('phone', v)} keyboardType="phone-pad" autoComplete="tel" />

              <Text style={styles.label}>Relationship</Text>
              <TextInput style={styles.input} placeholder="e.g. Daughter, Neighbor, Doctor" placeholderTextColor={theme.textSecondary} value={form.relationship} onChangeText={(v) => updateField('relationship', v)} />

              <View style={styles.switchSection}>
                <Text style={styles.switchSectionTitle}>Notifications</Text>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Emergency contact</Text>
                  <Switch value={form.isEmergency} onValueChange={(v) => updateField('isEmergency', v)} trackColor={{ true: theme.danger }} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Notify when I need help</Text>
                  <Switch value={form.notifyOnHelp} onValueChange={(v) => updateField('notifyOnHelp', v)} trackColor={{ true: theme.primary }} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Notify on missed check-in</Text>
                  <Switch value={form.notifyOnMissed} onValueChange={(v) => updateField('notifyOnMissed', v)} trackColor={{ true: theme.primary }} />
                </View>
                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Notify on declining trend</Text>
                  <Switch value={form.notifyOnDecline} onValueChange={(v) => updateField('notifyOnDecline', v)} trackColor={{ true: theme.primary }} />
                </View>
              </View>

              <Pressable
                disabled={saving || !canSave}
                style={({ pressed }) => [styles.saveButton, (pressed || saving || !canSave) && { opacity: 0.6 }]}
                onPress={onSave}>
                <Text style={styles.saveButtonText}>{saving ? 'Saving…' : editing ? 'Update Contact' : 'Add Contact'}</Text>
              </Pressable>
            </>
          )}

          {!foundUser && !editing && (
            <View style={styles.lookupHint}>
              <FontAwesome name="info-circle" size={15} color={theme.textSecondary} />
              <Text style={styles.lookupHintText}>
                Only people with a Sihaty account can be added as contacts.
                Ask them to sign up first, then enter their email here.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 },
  card: { backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { flex: 1, marginRight: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  cardName: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
  emergencyBadge: { backgroundColor: theme.danger, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  emergencyText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  sihatyBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: theme.primaryLight, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  sihatyBadgeText: { color: theme.primary, fontSize: 11, fontWeight: '700' },
  cardRelationship: { fontSize: 14, color: theme.textSecondary, marginTop: 2 },
  cardDetail: { fontSize: 14, color: theme.textSecondary, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 12 },
  actionButton: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center' },
  notifyRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  notifyChip: { backgroundColor: theme.primaryLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  notifyChipText: { fontSize: 12, fontWeight: '600', color: theme.primary },
  arrowBtns: { gap: 4 },
  arrowBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  arrowBtnDisabled: { backgroundColor: '#F9FAFB' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, borderRadius: 16, paddingVertical: 18, marginHorizontal: 20, marginTop: 8 },
  addBtnText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  addFirstBtn: { backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, marginTop: 20 },
  addFirstBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  emptyCard: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, paddingBottom: 100 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  emptySubtext: { fontSize: 16, color: theme.textSecondary, textAlign: 'center', lineHeight: 22 },
  emailRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  emailInput: { flex: 1 },
  findBtn: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  findBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  foundBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.primaryLight,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
    marginBottom: 4,
  },
  foundText: { fontSize: 14, fontWeight: '600', color: theme.primary, flex: 1 },
  lookupHint: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    paddingHorizontal: 4,
    alignItems: 'flex-start',
  },
  lookupHintText: { fontSize: 14, color: theme.textSecondary, flex: 1, lineHeight: 20 },
  modalContainer: { flex: 1, backgroundColor: theme.background },
  modalScroll: { padding: 24, paddingBottom: 48 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '700', color: theme.textPrimary },
  formError: { color: theme.danger, fontSize: 15, textAlign: 'center', marginBottom: 12 },
  label: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: theme.card, borderRadius: 14, padding: 18, fontSize: 17, color: theme.textPrimary, borderWidth: 1, borderColor: theme.border },
  switchSection: { marginTop: 24 },
  switchSectionTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginBottom: 12 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  switchLabel: { fontSize: 16, color: theme.textPrimary, flex: 1, marginRight: 12 },
  saveButton: { backgroundColor: theme.primary, borderRadius: 14, paddingVertical: 20, alignItems: 'center', marginTop: 28 },
  saveButtonText: { color: '#FFFFFF', fontSize: 19, fontWeight: '700' },
});
