import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Text } from "react-native";
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

export default function App() {
  return (
    <WalletProvider>
      <BalancesProvider>
        <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: "800" },
            tabBarStyle: {
              backgroundColor: colors.bgDeep,
              borderTopColor: colors.panelBorder,
              height: 62,
              paddingTop: 6,
              paddingBottom: 8,
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
        </NavigationContainer>
      </BalancesProvider>
    </WalletProvider>
  );
}
