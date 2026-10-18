#!/usr/bin/env bash
#
# Creates the self-signed code-signing identity custom macOS builds are signed with
# (config/scripts/build-custom.mjs). Squirrel.Mac installs an update only when its signature
# satisfies the running build's designated requirement, which for this identity is the
# certificate itself — so every machine that builds custom Orca must hold the SAME identity.
#
#   first machine:  bash config/scripts/setup-custom-signing-identity.sh
#   other machine:  export «Orca Custom Builds» from Keychain Access as .p12 on the first one, then
#                   bash config/scripts/setup-custom-signing-identity.sh --import orca-custom-builds.p12
#
# macOS asks for your password once: trusting the certificate for code signing is what makes
# `security find-identity -v` (and so electron-builder) accept it.
#
set -euo pipefail

NAME="${CSC_NAME:-Orca Custom Builds}"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"
# LibreSSL: its PKCS#12 encryption is the one `security import` reads; Homebrew's OpenSSL 3 is not.
OPENSSL=/usr/bin/openssl

has_identity() {
  security find-identity -v -p codesigning "$KEYCHAIN" | grep -qF "\"$NAME\""
}

if has_identity; then
  echo "Code-signing identity \"$NAME\" is already in the login keychain."
  exit 0
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

if [[ "${1:-}" == "--import" ]]; then
  p12="${2:?usage: setup-custom-signing-identity.sh --import path/to/identity.p12}"
  # Prompts for the .p12 password.
  security import "$p12" -k "$KEYCHAIN" -T /usr/bin/codesign
  security find-certificate -c "$NAME" -p "$KEYCHAIN" >"$work/cert.pem"
else
  cat >"$work/req.cnf" <<EOF
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = $NAME
[ext]
basicConstraints = critical, CA:false
keyUsage = critical, digitalSignature
extendedKeyUsage = critical, codeSigning
subjectKeyIdentifier = hash
EOF
  "$OPENSSL" req -x509 -newkey rsa:2048 -nodes -days 3650 -config "$work/req.cnf" \
    -keyout "$work/key.pem" -out "$work/cert.pem" 2>/dev/null
  # A throwaway password: the .p12 only carries the key into the keychain and is deleted on exit.
  pass="$("$OPENSSL" rand -hex 16)"
  "$OPENSSL" pkcs12 -export -inkey "$work/key.pem" -in "$work/cert.pem" -name "$NAME" \
    -out "$work/identity.p12" -passout "pass:$pass"
  security import "$work/identity.p12" -k "$KEYCHAIN" -P "$pass" -T /usr/bin/codesign
fi

echo "Trusting \"$NAME\" for code signing — macOS asks for your password."
security add-trusted-cert -r trustRoot -p codeSign -k "$KEYCHAIN" "$work/cert.pem"

if ! has_identity; then
  echo "\"$NAME\" is in the keychain but not a valid code-signing identity; check its trust in Keychain Access." >&2
  exit 1
fi
echo "Ready: pnpm build:mac:custom signs with \"$NAME\"."
