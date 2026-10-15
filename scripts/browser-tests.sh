#!/usr/bin/env bash
set -euo pipefail
# The CA is trusted only inside this disposable test container.
apt-get update -qq
apt-get install -y -qq libnss3-tools > /dev/null
mkdir -p /root/.pki/nssdb
certutil -N -d sql:/root/.pki/nssdb --empty-password
certutil -A -d sql:/root/.pki/nssdb -n imobitech-local-qa -t 'C,,' -i /caddy/caddy/pki/authorities/local/root.crt
export NODE_EXTRA_CA_CERTS=/caddy/caddy/pki/authorities/local/root.crt
node scripts/https-test.mjs
node node_modules/@playwright/test/cli.js test
