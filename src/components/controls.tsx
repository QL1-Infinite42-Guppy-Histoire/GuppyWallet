import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors } from "./ui";

export function Heading({ children }: { children: React.ReactNode }) {
  return <Text style={styles.heading}>{children}</Text>;
}

export function Body({ children }: { children: React.ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function PrimaryButton({
  label,
  onPress,
  loading,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable style={styles.button} onPress={onPress} disabled={loading}>
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.buttonText}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Visibly disabled action for not-yet-implementable features. */
export function DisabledButton({ label }: { label: string }) {
  return (
    <Pressable style={[styles.button, styles.buttonDisabled]} disabled>
      <Text style={styles.buttonTextDisabled}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "decimal-pad";
}) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType={keyboardType ?? "default"}
    />
  );
}

export interface ChipOption {
  key: string;
  label: string;
}

export function ChipPicker({
  options,
  value,
  onChange,
}: {
  options: ChipOption[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(o.key)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The four amount presets used everywhere an amount is chosen. */
export const PERCENT_PRESETS = [25, 50, 75, 100] as const;

/**
 * Shared 25% / 50% / 75% / MAX chips for amount inputs. The parent
 * computes the amount from the relevant balance (see percentOfBalance
 * in lib/onchain) — MAX handling (e.g. gas reserve) is the parent's job.
 */
export function PercentChips({
  onSelect,
  disabled,
}: {
  onSelect: (pct: number) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.pctRow}>
      {PERCENT_PRESETS.map((pct) => (
        <Pressable
          key={pct}
          style={[styles.pctChip, disabled && styles.pctChipDisabled]}
          onPress={() => onSelect(pct)}
          disabled={disabled}
        >
          <Text style={styles.pctChipText}>
            {pct === 100 ? "MAX" : `${pct}%`}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Segmented sub-navigation used inside the DeFi / NFT tabs. */
export function SegmentedTabs({
  options,
  value,
  onChange,
}: {
  options: ChipOption[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(o.key)}
          >
            <Text
              style={[styles.segmentText, active && styles.segmentTextActive]}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 16, fontWeight: "600" },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  button: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    overflow: "hidden",
    backgroundColor: colors.primary,
  },
  buttonDisabled: { backgroundColor: colors.panel },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
  buttonTextDisabled: { color: colors.muted, fontSize: 15, fontWeight: "700" },
  input: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    color: colors.text,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    backgroundColor: colors.glassField,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.glassChip,
  },
  chipActive: { backgroundColor: colors.gradStart, borderColor: colors.gradStart },
  chipText: { color: colors.text, fontSize: 13 },
  chipTextActive: { color: "#FFFFFF", fontWeight: "700" },
  pctRow: { flexDirection: "row", gap: 6, alignItems: "center" },
  pctChip: {
    borderColor: colors.panelBorder,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: colors.panel,
  },
  pctChipDisabled: { opacity: 0.4 },
  pctChipText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.glassChip,
    borderColor: colors.panelBorder,
    borderWidth: 1,
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    overflow: "hidden",
  },
  segmentActive: { backgroundColor: colors.primary },
  segmentText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  segmentTextActive: { color: "#FFFFFF", fontWeight: "800" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 2,
  },
  infoLabel: { color: colors.muted, fontSize: 13 },
  infoValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "right",
  },
});
