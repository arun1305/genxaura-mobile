#!/bin/sh
# Patches React Native scripts to handle paths with spaces.
# Required because the project path contains a space ("GenxAura_Source Code").
# This runs automatically via the postinstall npm hook.

# Detect sed flavor (macOS requires '' arg, GNU/Linux does not)
if sed --version 2>/dev/null | grep -q GNU; then
  sedi() { sed -i "$@"; }
else
  sedi() { sed -i '' "$@"; }
fi

RN_DIR="$(dirname "$0")/../node_modules/react-native"
EXPO_CONSTANTS_DIR="$(dirname "$0")/../node_modules/expo-constants"
EXPO_MODULES_CORE_DIR="$(dirname "$0")/../node_modules/expo-modules-core"

# 1. Fix script_phases.rb: quote the shell invocation
SCRIPT_PHASES_RB="$RN_DIR/scripts/react_native_pods_utils/script_phases.rb"
if grep -q '/bin/sh -c "\$WITH_ENVIRONMENT \$SCRIPT_PHASES_SCRIPT"' "$SCRIPT_PHASES_RB" 2>/dev/null; then
  sedi 's|/bin/sh -c "\$WITH_ENVIRONMENT \$SCRIPT_PHASES_SCRIPT"|/bin/sh "\$WITH_ENVIRONMENT" "\$SCRIPT_PHASES_SCRIPT"|g' "$SCRIPT_PHASES_RB"
  echo "[patch] Fixed script_phases.rb"
fi

# 2. Fix with-environment.sh: quote $1 → "$@"
WITH_ENV_SH="$RN_DIR/scripts/xcode/with-environment.sh"
if grep -q '  \$1$' "$WITH_ENV_SH" 2>/dev/null; then
  sedi 's/^  \$1$/  "\$@"/' "$WITH_ENV_SH"
  echo "[patch] Fixed with-environment.sh"
fi

# 3. Fix expo-constants podspec: quote path in script phase
PODSPEC="$EXPO_CONSTANTS_DIR/ios/EXConstants.podspec"
if grep -q 'bash -l -c "\$PODS_TARGET_SRCROOT' "$PODSPEC" 2>/dev/null; then
  sedi 's|bash -l -c "\$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"|bash -l -c "\\"\\$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\""|g' "$PODSPEC"
  echo "[patch] Fixed EXConstants.podspec"
fi

# 4. Fix ExpoAppInstance.swift: newArchEnabled() → fabricEnabled()
EXPO_APP_INSTANCE="$EXPO_MODULES_CORE_DIR/ios/AppDelegates/ExpoAppInstance.swift"
if grep -q 'newArchEnabled: newArchEnabled()' "$EXPO_APP_INSTANCE" 2>/dev/null; then
  sedi 's/newArchEnabled: newArchEnabled()/newArchEnabled: fabricEnabled()/' "$EXPO_APP_INSTANCE"
  echo "[patch] Fixed ExpoAppInstance.swift"
fi

echo "[patch] All patches applied."
