#!/usr/bin/env bash
set -euo pipefail
# Install branded browsers only inside this disposable Linux test container.
apt-get update -qq
apt-get install -y -qq libnss3-tools ca-certificates > /dev/null
mkdir -p /root/.pki/nssdb
certutil -N -d sql:/root/.pki/nssdb --empty-password
certutil -A -d sql:/root/.pki/nssdb -n imobitech-local-qa -t 'C,,' -i /caddy/caddy/pki/authorities/local/root.crt
cp /caddy/caddy/pki/authorities/local/root.crt /usr/local/share/ca-certificates/imobitech-qa.crt
update-ca-certificates > /dev/null
export NODE_EXTRA_CA_CERTS=/caddy/caddy/pki/authorities/local/root.crt
node node_modules/@playwright/test/cli.js install chrome msedge
node node_modules/@playwright/test/cli.js test --config playwright.compat.config.ts "$@"
