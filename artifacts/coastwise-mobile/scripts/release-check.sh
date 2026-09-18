#!/bin/sh
set -eu

export CI=1

output_root="$(mktemp -d)"
trap 'rm -rf "$output_root"' EXIT INT TERM

echo "Checking Expo dependency alignment..."
pnpm exec expo install --check

echo "Checking TypeScript..."
pnpm run typecheck

echo "Running Expo Doctor..."
pnpm dlx expo-doctor@latest

echo "Bundling iOS..."
pnpm exec expo export --platform ios --output-dir "$output_root/ios"

echo "Bundling Android..."
pnpm exec expo export --platform android --output-dir "$output_root/android"

echo "Coastwise mobile release check passed."