#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ok() { printf '[OK] %s\n' "$1"; }

select_cades_openssl() {
  local candidate
  local candidates=()
  if [[ -n "${FILE_VIEWER_OPENSSL:-}" ]]; then
    candidates+=("$FILE_VIEWER_OPENSSL")
  else
    candidate="$(command -v openssl || true)"
    [[ -n "$candidate" ]] && candidates+=("$candidate")
    if [[ -n "${HOMEBREW_PREFIX:-}" ]]; then
      candidates+=("$HOMEBREW_PREFIX/bin/openssl")
    fi
    candidates+=(
      /opt/homebrew/bin/openssl
      /opt/homebrew/opt/openssl@3/bin/openssl
      /usr/local/bin/openssl
      /usr/local/opt/openssl@3/bin/openssl
    )
  fi

  for candidate in "${candidates[@]}"; do
    if [[ "$candidate" != */* ]]; then
      candidate="$(command -v "$candidate" || true)"
    fi
    [[ -n "$candidate" && -x "$candidate" ]] || continue
    if "$candidate" cms -help 2>&1 | grep -Eq '(^|[[:space:]])-cades([[:space:]]|$)'; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

OPENSSL_BIN="$(select_cades_openssl || true)"
if [[ -z "$OPENSSL_BIN" ]]; then
  printf '%s\n' '[FAIL] CAdES fixture verification requires an OpenSSL executable whose cms help includes -cades.' >&2
  printf '%s\n' 'Install OpenSSL 3 or set FILE_VIEWER_OPENSSL to the supported executable.' >&2
  exit 2
fi
OPENSSL_VERSION="$("$OPENSSL_BIN" version 2>/dev/null || printf 'unknown')"
printf '[signature-fixtures] Using %s (%s)\n' "$OPENSSL_BIN" "$OPENSSL_VERSION"

"$OPENSSL_BIN" cms -verify -binary -inform DER \
  -in "$ROOT/cms/invoice-encapsulated.pdf.p7m" \
  -CAfile "$ROOT/certificates/test-root-ca.pem" -purpose any \
  -out "$TMP/invoice.pdf" >/dev/null 2>&1
cmp "$TMP/invoice.pdf" "$ROOT/originals/invoice.pdf"
ok 'encapsulated PDF CMS verifies and extracts byte-for-byte'

"$OPENSSL_BIN" cms -verify -cades -binary -inform DER \
  -in "$ROOT/cms/invoice-cades-bes.pdf.p7m" \
  -CAfile "$ROOT/certificates/test-root-ca.pem" -purpose any \
  -out "$TMP/invoice-cades.pdf" >/dev/null 2>&1
cmp "$TMP/invoice-cades.pdf" "$ROOT/originals/invoice.pdf"
ok 'CAdES-BES fixture verifies and extracts byte-for-byte'

"$OPENSSL_BIN" cms -verify -binary -inform DER \
  -in "$ROOT/cms/invoice-detached.pdf.p7s" \
  -content "$ROOT/originals/invoice.pdf" \
  -CAfile "$ROOT/certificates/test-root-ca.pem" -purpose any \
  -out /dev/null >/dev/null 2>&1
ok 'detached CMS verifies with the matching original'

if "$OPENSSL_BIN" cms -verify -binary -inform DER \
  -in "$ROOT/cms/invoice-detached.pdf.p7s" \
  -content "$ROOT/originals/invoice-tampered.pdf" \
  -CAfile "$ROOT/certificates/test-root-ca.pem" -purpose any \
  -out /dev/null >/dev/null 2>&1; then
  echo '[FAIL] detached CMS unexpectedly verified against altered content' >&2
  exit 1
fi
ok 'detached CMS correctly rejects the altered original'

"$OPENSSL_BIN" cms -verify -binary -inform DER \
  -in "$ROOT/cms/hello-multi-signer.p7m" \
  -CAfile "$ROOT/certificates/test-root-ca.pem" -purpose any \
  -out "$TMP/hello.txt" >/dev/null 2>&1
cmp "$TMP/hello.txt" "$ROOT/originals/hello.txt"
ok 'multi-signer CMS verifies and extracts content'

"$OPENSSL_BIN" cms -verify -binary -inform DER \
  -in "$ROOT/cms/invoice-double-signed.p7m" \
  -CAfile "$ROOT/certificates/test-root-ca.pem" -purpose any \
  -out "$TMP/inner.p7m" >/dev/null 2>&1
"$OPENSSL_BIN" cms -verify -binary -inform DER \
  -in "$TMP/inner.p7m" \
  -CAfile "$ROOT/certificates/test-root-ca.pem" -purpose any \
  -out "$TMP/nested-invoice.pdf" >/dev/null 2>&1
cmp "$TMP/nested-invoice.pdf" "$ROOT/originals/invoice.pdf"
ok 'nested CMS verifies through both layers'

"$OPENSSL_BIN" ts -verify -data "$ROOT/originals/invoice.pdf" \
  -in "$ROOT/timestamps/invoice-sha256.tsr" \
  -CAfile "$ROOT/certificates/test-root-ca.pem" \
  -untrusted "$ROOT/certificates/test-tsa.pem" >/dev/null 2>&1
ok 'RFC 3161 response verifies against invoice.pdf'

"$OPENSSL_BIN" ts -verify -token_in -data "$ROOT/originals/invoice.pdf" \
  -in "$ROOT/timestamps/invoice-sha256.tst" \
  -CAfile "$ROOT/certificates/test-root-ca.pem" \
  -untrusted "$ROOT/certificates/test-tsa.pem" >/dev/null 2>&1
ok 'standalone RFC 3161 token verifies against invoice.pdf'

if "$OPENSSL_BIN" ts -verify -data "$ROOT/originals/invoice-tampered.pdf" \
  -in "$ROOT/timestamps/invoice-sha256.tsr" \
  -CAfile "$ROOT/certificates/test-root-ca.pem" \
  -untrusted "$ROOT/certificates/test-tsa.pem" >/dev/null 2>&1; then
  echo '[FAIL] timestamp unexpectedly verified against altered content' >&2
  exit 1
fi
ok 'RFC 3161 response correctly rejects altered content'

"$OPENSSL_BIN" asn1parse -inform DER -in "$ROOT/timestamps/invoice-embedded.tsd" -noout >/dev/null
"$OPENSSL_BIN" asn1parse -inform DER -in "$ROOT/timestamps/invoice-external-content.tsd" -noout >/dev/null
ok 'RFC 5544 fixtures are structurally valid (content/imprint assertions run in verify:github-206)'

printf '\nAll expected positive and negative checks passed.\n'
