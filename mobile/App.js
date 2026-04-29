import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

const tabs = [
  { id: "providers", label: "Providers", icon: "server-outline" },
  { id: "tracker", label: "Tracker", icon: "analytics-outline" },
  { id: "settings", label: "Settings", icon: "settings-outline" }
];

const initialApiUrl = process.env.EXPO_PUBLIC_9ROUTER_API_URL || "http://10.0.2.2:3000";

export default function App() {
  const [activeTab, setActiveTab] = useState("providers");
  const [apiUrl, setApiUrl] = useState(initialApiUrl);
  const [draftApiUrl, setDraftApiUrl] = useState(initialApiUrl);
  const [providers, setProviders] = useState([]);
  const [tracker, setTracker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const enabledCount = useMemo(() => providers.filter((provider) => provider.enabled).length, [providers]);
  const health = useMemo(() => {
    if (!providers.length) return "unknown";
    return providers.every((provider) => provider.status === "healthy" || !provider.enabled) ? "healthy" : "warning";
  }, [providers]);

  async function request(path, options) {
    const response = await fetch(`${apiUrl}${path}`, {
      headers: {
        "content-type": "application/json",
        ...(options?.headers || {})
      },
      ...options
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Request failed");
    return body;
  }

  async function loadData({ quiet = false } = {}) {
    if (!quiet) setLoading(true);
    setError("");

    try {
      const [providerBody, trackerBody] = await Promise.all([
        request("/api/providers"),
        request("/api/tracker")
      ]);
      setProviders(providerBody.providers);
      setTracker(trackerBody.tracker);
    } catch (apiError) {
      setError(apiError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [apiUrl]);

  async function saveProviders(nextProviders) {
    setProviders(nextProviders);
    try {
      const body = await request("/api/providers", {
        method: "PUT",
        body: JSON.stringify({ providers: nextProviders })
      });
      setProviders(body.providers);
    } catch (apiError) {
      Alert.alert("Không lưu được", apiError.message);
      loadData({ quiet: true });
    }
  }

  async function testProvider(id) {
    try {
      const body = await request("/api/providers/test", {
        method: "POST",
        body: JSON.stringify({ id })
      });
      Alert.alert("Kết nối provider", body.ok ? `OK trong ${body.latencyMs}ms` : "Provider đang tắt");
      loadData({ quiet: true });
    } catch (apiError) {
      Alert.alert("Test thất bại", apiError.message);
    }
  }

  function updateProvider(id, patch) {
    saveProviders(providers.map((provider) => (provider.id === id ? { ...provider, ...patch } : provider)));
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>9router</Text>
            <Text style={styles.subtitle}>Provider config & tracker</Text>
          </View>
          <View style={[styles.healthPill, health === "healthy" ? styles.healthOk : styles.healthWarn]}>
            <View style={[styles.healthDot, health === "healthy" ? styles.dotOk : styles.dotWarn]} />
            <Text style={styles.healthText}>{health === "healthy" ? "Healthy" : "Check"}</Text>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <SummaryMetric label="Active" value={`${enabledCount}/${providers.length || 0}`} icon="flash-outline" />
          <SummaryMetric label="Latency" value={`${tracker?.totals.avgLatencyMs || 0}ms`} icon="speedometer-outline" />
          <SummaryMetric label="Cost" value={`$${tracker?.totals.costUsd?.toFixed(0) || 0}`} icon="card-outline" />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#0f766e" />
            <Text style={styles.muted}>Đang tải dashboard...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  loadData({ quiet: true });
                }}
              />
            }
          >
            {error ? <ErrorBanner message={error} /> : null}
            {activeTab === "providers" ? (
              <ProvidersView providers={providers} onUpdate={updateProvider} onTest={testProvider} />
            ) : null}
            {activeTab === "tracker" ? <TrackerView tracker={tracker} providers={providers} /> : null}
            {activeTab === "settings" ? (
              <SettingsView
                apiUrl={apiUrl}
                draftApiUrl={draftApiUrl}
                onDraftChange={setDraftApiUrl}
                onApply={() => setApiUrl(draftApiUrl.replace(/\/$/, ""))}
                onReload={() => loadData()}
              />
            ) : null}
          </ScrollView>
        )}

        <View style={styles.tabBar}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.id}
              accessibilityRole="button"
              style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Ionicons name={tab.icon} size={20} color={activeTab === tab.id ? "#ffffff" : "#475569"} />
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function SummaryMetric({ label, value, icon }) {
  return (
    <View style={styles.metricBox}>
      <Ionicons name={icon} size={18} color="#0f766e" />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function ErrorBanner({ message }) {
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="warning-outline" size={18} color="#b45309" />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

function ProvidersView({ providers, onUpdate, onTest }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Nhà cung cấp</Text>
      {providers.map((provider) => (
        <View key={provider.id} style={styles.providerCard}>
          <View style={styles.providerTop}>
            <View style={styles.providerNameRow}>
              <View style={[styles.providerLogo, provider.enabled ? styles.logoEnabled : styles.logoDisabled]}>
                <Text style={styles.providerLogoText}>{provider.name.slice(0, 1)}</Text>
              </View>
              <View style={styles.providerText}>
                <Text style={styles.providerName}>{provider.name}</Text>
                <Text numberOfLines={1} style={styles.providerUrl}>{provider.baseUrl}</Text>
              </View>
            </View>
            <Switch
              value={provider.enabled}
              onValueChange={(enabled) => onUpdate(provider.id, { enabled, status: enabled ? "healthy" : "paused" })}
              trackColor={{ false: "#cbd5e1", true: "#99f6e4" }}
              thumbColor={provider.enabled ? "#0f766e" : "#f8fafc"}
            />
          </View>

          <View style={styles.modelWrap}>
            {provider.models.map((model) => (
              <View key={model} style={styles.modelChip}>
                <Text style={styles.modelText}>{model}</Text>
              </View>
            ))}
          </View>

          <View style={styles.providerControls}>
            <View style={styles.priorityBox}>
              <Text style={styles.controlLabel}>Ưu tiên</Text>
              <View style={styles.stepper}>
                <IconButton icon="remove-outline" onPress={() => onUpdate(provider.id, { priority: Math.max(1, provider.priority - 1) })} />
                <Text style={styles.priorityValue}>{provider.priority}</Text>
                <IconButton icon="add-outline" onPress={() => onUpdate(provider.id, { priority: provider.priority + 1 })} />
              </View>
            </View>
            <View style={styles.fallbackBox}>
              <Text style={styles.controlLabel}>Fallback</Text>
              <Switch
                value={provider.fallback}
                onValueChange={(fallback) => onUpdate(provider.id, { fallback })}
                trackColor={{ false: "#cbd5e1", true: "#bfdbfe" }}
                thumbColor={provider.fallback ? "#2563eb" : "#f8fafc"}
              />
            </View>
            <Pressable style={styles.testButton} onPress={() => onTest(provider.id)}>
              <Ionicons name="pulse-outline" size={18} color="#ffffff" />
              <Text style={styles.testButtonText}>Kiểm tra</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function TrackerView({ tracker, providers }) {
  if (!tracker) return null;
  const maxRequests = Math.max(...tracker.series.map((item) => item.requests), 1);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Theo dõi</Text>
      <View style={styles.chartPanel}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartValue}>{tracker.totals.requests.toLocaleString("en-US")}</Text>
          <Text style={styles.muted}>requests hôm nay</Text>
        </View>
        <View style={styles.barChart}>
          {tracker.series.map((item) => (
            <View key={item.label} style={styles.barColumn}>
              <View style={[styles.bar, { height: 24 + (item.requests / maxRequests) * 96 }]} />
              <Text style={styles.barLabel}>{item.label.slice(0, 2)}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Tokens" value={`${(tracker.totals.tokens / 1000000).toFixed(1)}M`} icon="layers-outline" />
        <StatCard label="Lỗi" value={`${tracker.totals.errorRate}%`} icon="alert-circle-outline" />
        <StatCard label="Độ trễ" value={`${tracker.totals.avgLatencyMs}ms`} icon="timer-outline" />
        <StatCard label="Chi phí" value={`$${tracker.totals.costUsd.toFixed(2)}`} icon="wallet-outline" />
      </View>

      <Text style={styles.sectionTitleSmall}>Provider usage</Text>
      {tracker.providers.map((item) => {
        const provider = providers.find((entry) => entry.id === item.id);
        return (
          <View key={item.id} style={styles.usageRow}>
            <View>
              <Text style={styles.usageName}>{provider?.name || item.id}</Text>
              <Text style={styles.muted}>{item.avgLatencyMs}ms · {item.errorRate}% lỗi</Text>
            </View>
            <Text style={styles.usageValue}>{item.requests.toLocaleString("en-US")}</Text>
          </View>
        );
      })}

      <Text style={styles.sectionTitleSmall}>Sự kiện gần đây</Text>
      {tracker.events.map((event) => (
        <View key={event.id} style={styles.eventRow}>
          <View style={[styles.eventDot, event.level === "warning" ? styles.dotWarn : styles.dotOk]} />
          <Text style={styles.eventText}>{event.message}</Text>
        </View>
      ))}
    </View>
  );
}

function SettingsView({ apiUrl, draftApiUrl, onDraftChange, onApply, onReload }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Cấu hình app</Text>
      <View style={styles.settingsPanel}>
        <Text style={styles.inputLabel}>9router API URL</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          value={draftApiUrl}
          onChangeText={onDraftChange}
          placeholder="http://10.0.2.2:3000"
          style={styles.input}
        />
        <Text style={styles.settingsHint}>Đang dùng: {apiUrl}</Text>
        <View style={styles.settingsActions}>
          <Pressable style={styles.secondaryButton} onPress={onReload}>
            <Ionicons name="refresh-outline" size={18} color="#0f172a" />
            <Text style={styles.secondaryButtonText}>Tải lại</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={onApply}>
            <Ionicons name="checkmark-outline" size={18} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Áp dụng</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function IconButton({ icon, onPress }) {
  return (
    <Pressable accessibilityRole="button" style={styles.iconButton} onPress={onPress}>
      <Ionicons name={icon} size={16} color="#0f172a" />
    </Pressable>
  );
}

function StatCard({ label, value, icon }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={18} color="#2563eb" />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f6f8fb"
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10
  },
  appName: {
    color: "#0f172a",
    fontSize: 30,
    fontWeight: "800"
  },
  subtitle: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 2
  },
  healthPill: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  healthOk: {
    backgroundColor: "#ccfbf1"
  },
  healthWarn: {
    backgroundColor: "#fef3c7"
  },
  healthDot: {
    borderRadius: 999,
    height: 8,
    width: 8
  },
  dotOk: {
    backgroundColor: "#0f766e"
  },
  dotWarn: {
    backgroundColor: "#d97706"
  },
  healthText: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "800"
  },
  summaryRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 18
  },
  metricBox: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    padding: 12
  },
  metricValue: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 8
  },
  metricLabel: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2
  },
  content: {
    padding: 20,
    paddingBottom: 108
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    gap: 10
  },
  muted: {
    color: "#64748b",
    fontSize: 13
  },
  errorBanner: {
    alignItems: "center",
    backgroundColor: "#fffbeb",
    borderColor: "#fde68a",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    padding: 12
  },
  errorText: {
    color: "#92400e",
    flex: 1,
    fontSize: 13
  },
  section: {
    gap: 12
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "800"
  },
  sectionTitleSmall: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 10
  },
  providerCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14
  },
  providerTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between"
  },
  providerNameRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12
  },
  providerLogo: {
    alignItems: "center",
    borderRadius: 8,
    height: 42,
    justifyContent: "center",
    width: 42
  },
  logoEnabled: {
    backgroundColor: "#0f766e"
  },
  logoDisabled: {
    backgroundColor: "#94a3b8"
  },
  providerLogoText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900"
  },
  providerText: {
    flex: 1
  },
  providerName: {
    color: "#0f172a",
    fontSize: 17,
    fontWeight: "800"
  },
  providerUrl: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 3
  },
  modelWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14
  },
  modelChip: {
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  modelText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "700"
  },
  providerControls: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginTop: 14
  },
  priorityBox: {
    gap: 6
  },
  fallbackBox: {
    alignItems: "center",
    gap: 4
  },
  controlLabel: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700"
  },
  stepper: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    height: 32,
    justifyContent: "center",
    width: 32
  },
  priorityValue: {
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
    minWidth: 16,
    textAlign: "center"
  },
  testButton: {
    alignItems: "center",
    backgroundColor: "#0f766e",
    borderRadius: 8,
    flexDirection: "row",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12
  },
  testButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800"
  },
  chartPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16
  },
  chartHeader: {
    marginBottom: 12
  },
  chartValue: {
    color: "#0f172a",
    fontSize: 30,
    fontWeight: "900"
  },
  barChart: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 10,
    height: 150,
    justifyContent: "space-between"
  },
  barColumn: {
    alignItems: "center",
    flex: 1,
    justifyContent: "flex-end"
  },
  bar: {
    backgroundColor: "#0f766e",
    borderRadius: 6,
    width: "100%"
  },
  barLabel: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 6
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  statCard: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    width: "48%"
  },
  statValue: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 8
  },
  statLabel: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2
  },
  usageRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 14
  },
  usageName: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800"
  },
  usageValue: {
    color: "#0f766e",
    fontSize: 16,
    fontWeight: "900"
  },
  eventRow: {
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12
  },
  eventDot: {
    borderRadius: 999,
    height: 9,
    width: 9
  },
  eventText: {
    color: "#334155",
    flex: 1,
    fontSize: 13,
    fontWeight: "600"
  },
  settingsPanel: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    padding: 16
  },
  inputLabel: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8
  },
  input: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    borderRadius: 8,
    borderWidth: 1,
    color: "#0f172a",
    fontSize: 15,
    minHeight: 46,
    paddingHorizontal: 12
  },
  settingsHint: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 10
  },
  settingsActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 46
  },
  secondaryButtonText: {
    color: "#0f172a",
    fontWeight: "800"
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#0f766e",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 46
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800"
  },
  tabBar: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
    borderRadius: 8,
    borderWidth: 1,
    bottom: 18,
    flexDirection: "row",
    gap: 8,
    left: 20,
    padding: 8,
    position: "absolute",
    right: 20
  },
  tabButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 44
  },
  tabButtonActive: {
    backgroundColor: "#0f766e"
  },
  tabText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "800"
  },
  tabTextActive: {
    color: "#ffffff"
  }
});
