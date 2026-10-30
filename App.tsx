import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { Text } from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { colors } from "./src/components/ui";
import { BalancesProvider } from "./src/context/BalancesContext";
import { LanguageProvider, useI18n } from "./src/context/LanguageContext";
import { WalletProvider } from "./src/context/WalletContext";
import DeFiScreen from "./src/screens/DeFiScreen";
import ExploreScreen from "./src/screens/ExploreScreen";
import HomeScreen from "./src/screens/HomeScreen";
import NftScreen from "./src/screens/NftScreen";
import SendScreen from "./src/screens/SendScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import TokenListScreen from "./src/screens/TokenListScreen";

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();

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

/**
 * Home tab stack: Home (dashboard) → TokenList / Send.
 * Balances live only here; Send is reached from Home's quick action;
 * wallet management lives only in Settings. There is no Wallet tab.
 */
function HomeStackNavigator() {
  const { t } = useI18n();
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: "800" },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <HomeStack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{ title: t("tab.home") }}
      />
      <HomeStack.Screen
        name="TokenList"
        component={TokenListScreen}
        options={{ title: t("tokens.title") }}
      />
      <HomeStack.Screen
        name="Send"
        component={SendScreen}
        options={{ title: t("send.title") }}
      />
    </HomeStack.Navigator>
  );
}

// Base height of the tab content area (icons + labels), excluding the
// Android/iOS system navigation inset at the bottom.
const TAB_BAR_BASE_HEIGHT = 62;

function TabNavigator() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
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
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeStackNavigator}
        options={{
          title: t("tab.home"),
          tabBarLabel: t("tab.home"),
          tabBarIcon: tabIcon("⌂"),
          headerShown: false,
        }}
      />
      <Tab.Screen
        name="DeFi"
        component={DeFiScreen}
        options={{
          title: t("tab.defi"),
          tabBarLabel: t("tab.defi"),
          tabBarIcon: tabIcon("◈"),
        }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          title: t("tab.explore"),
          tabBarLabel: t("tab.explore"),
          tabBarIcon: tabIcon("◎"),
        }}
      />
      <Tab.Screen
        name="NFT"
        component={NftScreen}
        options={{
          title: t("tab.nft"),
          tabBarLabel: t("tab.nft"),
          tabBarIcon: tabIcon("▣"),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: t("tab.settings"),
          tabBarLabel: t("tab.settings"),
          tabBarIcon: tabIcon("⚙"),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <WalletProvider>
          <BalancesProvider>
            <NavigationContainer>
              <StatusBar style="dark" />
              <TabNavigator />
            </NavigationContainer>
          </BalancesProvider>
        </WalletProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
