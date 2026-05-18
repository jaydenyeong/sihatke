import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/constants/Colors';
import { WatchingList } from '@/components/WatchingList';
import { MyContactsList } from '@/components/MyContactsList';
import { Pressable } from 'react-native';

type Tab = 'watching' | 'contacts';

export default function CircleScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('watching');
  const [editing, setEditing] = useState(false);

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    setEditing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>My Circle</Text>
        {/* Edit Order only shown on My Contacts tab */}
        {activeTab === 'contacts' && (
          <Pressable
            style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}
            onPress={() => setEditing((e) => !e)}>
            <Text style={styles.editBtnText}>{editing ? 'Done' : 'Edit Order'}</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.segControl}>
        <Pressable
          style={[styles.segBtn, activeTab === 'watching' && styles.segBtnActive]}
          onPress={() => switchTab('watching')}>
          <Text style={[styles.segBtnText, activeTab === 'watching' && styles.segBtnTextActive]}>
            Watching
          </Text>
        </Pressable>
        <Pressable
          style={[styles.segBtn, activeTab === 'contacts' && styles.segBtnActive]}
          onPress={() => switchTab('contacts')}>
          <Text style={[styles.segBtnText, activeTab === 'contacts' && styles.segBtnTextActive]}>
            My Contacts
          </Text>
        </Pressable>
      </View>

      {activeTab === 'watching' ? (
        <WatchingList editing={editing} />
      ) : (
        <MyContactsList editing={editing} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    minHeight: 60,
  },
  title: { fontSize: 28, fontWeight: '700', color: theme.textPrimary },
  editBtn: {
    backgroundColor: theme.primaryLight,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editBtnText: { fontSize: 14, fontWeight: '700', color: theme.primary },
  segControl: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 3,
    gap: 3,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  segBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segBtnText: { fontSize: 14, fontWeight: '600', color: theme.textSecondary },
  segBtnTextActive: { color: theme.primary },
});
