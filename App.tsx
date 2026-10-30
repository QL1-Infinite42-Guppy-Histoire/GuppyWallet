import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Text } from "react-native";
import { colors } from "./src/components/ui";
import { WatchAddressProvider } from "./src/context/WatchAddressContext";
import DashboardScreen from "./src/screens/DashboardScreen";
import MoreScreen from "./src/screens/MoreScreen";
import StakingScreen from "./src/screens/StakingScreen";
import SwapScreen from "./src/screens/SwapScreen";
import WalletScreen from "./src/screens/WalletScreen";

const Tab = createBottomTabNavigator();

function tabIcon(symbol: string) {
  return ({ color }: { color: string }) => (
    <Text style={{ color, fontSize: 18 }}>{symbol}</Text>
  );
}

export default function App() {
  return (
    <WatchAddressProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.muted,
          }}
        >
          <Tab.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ title: "ダッシュボード", tabBarIcon: tabIcon("▦") }}
          />
          <Tab.Screen
            name="Wallet"
            component={WalletScreen}
            options={{ title: "ウォレット", tabBarIcon: tabIcon("◉") }}
          />
          <Tab.Screen
            name="Swap"
            component={SwapScreen}
            options={{ title: "スワップ", tabBarIcon: tabIcon("⇄") }}
          />
          <Tab.Screen
            name="Staking"
            component={StakingScreen}
            options={{ title: "ステーキング", tabBarIcon: tabIcon("◈") }}
          />
          <Tab.Screen
            name="More"
            component={MoreScreen}
            options={{ title: "その他", tabBarIcon: tabIcon("☰") }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </WatchAddressProvider>
  );
}
