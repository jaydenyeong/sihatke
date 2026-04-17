import { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  RefreshControl,
  Modal,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
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

export default function ContactsScreen() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalVisible(true);
  };

  const openEdit = (contact: Contact) => {
    setEditing(contact);
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
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormError('Name is required');
      return;
    }
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
      if (editing) {
        await apiRequest(`/contacts/${editing._id}`, { method: 'PUT', body });
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
            } catch {
              // Silent
            }
          },
        },
      ]
    );
  };

  const updateField = (key: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const renderContact = ({ item }: { item: Contact }) => (
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
          </View>
          {item.relationship ? (
            <Text style={styles.cardRelationship}>{item.relationship}</Text>
          ) : null}
          {item.phone ? (
            <Text style={styles.cardDetail}>{item.phone}</Text>
          ) : null}
        </View>
        <View style={styles.cardActions}>
          <Pressable
            style={styles.actionButton}
            onPress={() => openEdit(item)}
            hitSlop={8}>
            <FontAwesome name="pencil" size={18} color={theme.primary} />
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => handleDelete(item)}
            hitSlop={8}>
            <FontAwesome name="trash" size={18} color={theme.danger} />
          </Pressable>
        </View>
      </View>
      <View style={styles.notifyRow}>
        {item.notifyOnHelp && (
          <View style={styles.notifyChip}>
            <Text style={styles.notifyChipText}>Help</Text>
          </View>
        )}
        {item.notifyOnMissed && (
          <View style={styles.notifyChip}>
            <Text style={styles.notifyChipText}>Missed</Text>
          </View>
        )}
        {item.notifyOnDecline && (
          <View style={styles.notifyChip}>
            <Text style={styles.notifyChipText}>Decline</Text>
          </View>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Trusted Contacts</Text>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && { opacity: 0.7 }]}
          onPress={openAdd}>
          <FontAwesome name="plus" size={16} color="#FFFFFF" />
        </Pressable>
      </View>

      {loaded && contacts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>👨‍👩‍👧‍👦</Text>
          <Text style={styles.emptyTitle}>No contacts yet</Text>
          <Text style={styles.emptySubtext}>
            Add family or trusted people who should be notified about your well-being
          </Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item._id}
          renderItem={renderContact}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
            />
          }
        />
      )}

      {/* Add / Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editing ? 'Edit Contact' : 'Add Contact'}
                </Text>
                <Pressable
                  onPress={() => setModalVisible(false)}
                  hitSlop={12}>
                  <FontAwesome name="times" size={22} color={theme.textSecondary} />
                </Pressable>
              </View>

              {formError ? <Text style={styles.formError}>{formError}</Text> : null}

              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Full name"
                placeholderTextColor={theme.textSecondary}
                value={form.name}
                onChangeText={(v) => updateField('name', v)}
                autoComplete="name"
              />

              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="Phone number"
                placeholderTextColor={theme.textSecondary}
                value={form.phone}
                onChangeText={(v) => updateField('phone', v)}
                keyboardType="phone-pad"
                autoComplete="tel"
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Email address"
                placeholderTextColor={theme.textSecondary}
                value={form.email}
                onChangeText={(v) => updateField('email', v)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <Text style={styles.label}>Relationship</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Daughter, Neighbor, Doctor"
                placeholderTextColor={theme.textSecondary}
                value={form.relationship}
                onChangeText={(v) => updateField('relationship', v)}
              />

              <View style={styles.switchSection}>
                <Text style={styles.switchSectionTitle}>Notifications</Text>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Emergency contact</Text>
                  <Switch
                    value={form.isEmergency}
                    onValueChange={(v) => updateField('isEmergency', v)}
                    trackColor={{ true: theme.danger }}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Notify when I need help</Text>
                  <Switch
                    value={form.notifyOnHelp}
                    onValueChange={(v) => updateField('notifyOnHelp', v)}
                    trackColor={{ true: theme.primary }}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Notify on missed check-in</Text>
                  <Switch
                    value={form.notifyOnMissed}
                    onValueChange={(v) => updateField('notifyOnMissed', v)}
                    trackColor={{ true: theme.primary }}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>Notify on declining trend</Text>
                  <Switch
                    value={form.notifyOnDecline}
                    onValueChange={(v) => updateField('notifyOnDecline', v)}
                    trackColor={{ true: theme.primary }}
                  />
                </View>
              </View>

              <Pressable
                disabled={saving}
                style={({ pressed }) => [
                  styles.saveButton,
                  (pressed || saving) && { opacity: 0.85 },
                ]}
                onPress={handleSave}>
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving…' : editing ? 'Update Contact' : 'Add Contact'}
                </Text>
              </Pressable>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  addButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardInfo: {
    flex: 1,
    marginRight: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  emergencyBadge: {
    backgroundColor: theme.danger,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  emergencyText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  cardRelationship: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 2,
  },
  cardDetail: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notifyRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
  },
  notifyChip: {
    backgroundColor: theme.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  notifyChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.primary,
  },
  emptyCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  modalScroll: {
    padding: 24,
    paddingBottom: 48,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  formError: {
    color: theme.danger,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: theme.card,
    borderRadius: 14,
    padding: 18,
    fontSize: 17,
    color: theme.textPrimary,
    borderWidth: 1,
    borderColor: theme.border,
  },
  switchSection: {
    marginTop: 24,
  },
  switchSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  switchLabel: {
    fontSize: 16,
    color: theme.textPrimary,
    flex: 1,
    marginRight: 12,
  },
  saveButton: {
    backgroundColor: theme.primary,
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
    marginTop: 28,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
  },
});
