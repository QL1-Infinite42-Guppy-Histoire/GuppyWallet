import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

export const colors = {
  bg: "#0B0F19",
  card: "#141B2D",
  border: "#26314D",
  text: "#E8ECF4",
  muted: "#93A0B8",
  accent: "#F5C542",
  dangerBg: "#3A1620",
  dangerText: "#FFB3C0",
};

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {children}
    </ScrollView>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

/** Shown on every screen until the app has passed a security audit. */
export function PrototypeWarning() {
  return (
    <View style={styles.warning}>
      <Text style={styles.warningText}>
        ⚠️ 試作版（未監査）です。署名・送信機能は有効化されていますが、必ず少額でテストしてください。
        リカバリーフレーズは紙に書いて保管し、誰にも教えないでください。
      </Text>
    </View>
  );
}

export function TodoMt({ items }: { items: string[] }) {
  return (
    <Card>
      <Text style={styles.cardTitle}>MTさんからの受領待ち（TODO_MT）</Text>
      {items.map((item) => (
        <Text key={item} style={styles.todoItem}>
          • {item}
        </Text>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: "700" },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "600" },
  todoItem: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  warning: {
    backgroundColor: colors.dangerBg,
    borderRadius: 10,
    padding: 12,
  },
  warningText: { color: colors.dangerText, fontSize: 13, lineHeight: 19 },
});
