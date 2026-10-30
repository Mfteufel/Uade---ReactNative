import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '../../components/Button';
import SearchFields from '../../components/SearchFields';
import useSearchScreen from '../../hooks/useSearchScreen';
import { colors, spacing } from '../../constants/theme';
import { describeSearch } from '../../utils/formatSearch';

// Pantalla de inicio: buscador guiado (qué te pasó, qué es, dónde, cuándo) y búsquedas recientes.
export default function SearchScreen({ navigation }) {
  const { filters, recents, recentsError, loadRecents, error, onSearch, onRepeat } = useSearchScreen(navigation);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.links}>
        <Button variant="link" title="Mi perfil" onPress={() => navigation.navigate('MyProfile')} />
        <Button variant="link" title="Mis reclamos" onPress={() => navigation.navigate('MyClaims')} />
        <Button variant="link" title="Mi historial" onPress={() => navigation.navigate('History')} />
        <Button variant="link" title="Configuración" onPress={() => navigation.navigate('Settings')} />
      </View>

      <Text style={styles.heading}>¿Qué estás buscando?</Text>

      <SearchFields filters={filters} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Buscar" onPress={onSearch} />
      <Button variant="link" title="¿Perdiste o encontraste algo? Publicalo" onPress={() => navigation.navigate('Publish')} />

      <View style={styles.recents}>
        <Text style={styles.recentsTitle}>Búsquedas recientes</Text>
        {recentsError ? (
          <View>
            <Text style={styles.error}>{recentsError}</Text>
            <Button variant="link" title="Reintentar" onPress={loadRecents} />
          </View>
        ) : recents.length === 0 ? (
          <Text style={styles.muted}>Todavía no hiciste ninguna búsqueda.</Text>
        ) : (
          recents.map((recent) => (
            <Pressable key={recent.id} onPress={() => onRepeat(recent)} style={styles.recent}>
              <Text style={styles.recentText}>{describeSearch(recent, filters.categories, filters.neighborhoods)}</Text>
            </Pressable>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, backgroundColor: colors.background, flexGrow: 1 },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: spacing.sm },
  heading: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: spacing.lg },
  error: { color: colors.error, marginBottom: spacing.sm },
  muted: { color: colors.muted },
  recents: { marginTop: spacing.xl },
  recentsTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  recent: { backgroundColor: colors.surface, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm },
  recentText: { color: colors.text },
});
