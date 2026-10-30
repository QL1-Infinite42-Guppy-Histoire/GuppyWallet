import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Text } from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { colors } from "./src/components/ui";
import { WalletProvider } from "./src/context/WalletContext";
import { BalancesProvider } from "./src/context/BalancesContext";
import DashboardScreen from "./src/screens/DashboardScreen";
import MoreScreen from "./src/screens/MoreScreen";
import StakingScreen from "./src/screens/StakingScreen";
import SwapScreen from "./src/screens/SwapScreen";
import WalletScreen from "./src/screens/WalletScreen";

const Tab = createBottomTabNavigator();

function tabIcon(symbol: string) {
  return ({
    color,
    focused,
  }: {
    color: string;
    focused: boolean;
  }) => (
    <Text
      style={{
        color,
        fontSize: focused ? 23 : 21,
        fontWeight: focused ? "800" : "400",
      }}
    >
      {symbol}
    </Text>
  );
}

// Base height of the tab content area (icons + labels), excluding the
// Android/iOS system navigation inset at the bottom.
const TAB_BAR_BASE_HEIGHT = 62;

function TabNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "800" },
        tabBarStyle: {
          // Solid opaque bar that extends under the system navigation
          // area; height and bottom padding grow by the device inset so
          // the tabs themselves sit fully above the system buttons.
          backgroundColor: colors.bgDeep,
          borderTopColor: colors.panelBorder,
          borderTopWidth: 1,
          height: TAB_BAR_BASE_HEIGHT + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: "ホーム", tabBarIcon: tabIcon("⌂") }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ title: "ウォレット", tabBarIcon: tabIcon("◉") }}
      />
      <Tab.Screen
        name="Swap"
        component={SwapScreen}
        options={{ title: "Swap", tabBarIcon: tabIcon("⇄") }}
      />
      <Tab.Screen
        name="Staking"
        component={StakingScreen}
        options={{ title: "ステーキング", tabBarIcon: tabIcon("◈") }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{ title: "もっと", tabBarIcon: tabIcon("☰") }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <WalletProvider>
        <BalancesProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            <TabNavigator />
          </NavigationContainer>
        </BalancesProvider>
      </WalletProvider>
    </SafeAreaProvider>
  );
}
