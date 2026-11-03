#!/bin/sh
set -eu
umask 077
mkdir -p /backups
while :; do
  stamp=$(date -u +%Y%m%dT%H%M%SZ)
  file="/backups/imobitech-$stamp.dump"
  if pg_dump --format=custom --file="$file.tmp"; then
    mv "$file.tmp" "$file"
    photos="/backups/imobitech-$stamp-photos.tar.gz"
    if tar -czf "$photos.tmp" -C /photos .; then
      mv "$photos.tmp" "$photos"
      echo "Backup do banco e das fotos concluído: $stamp"
    else
      rm -f "$photos.tmp"
      echo 'Falha no backup das fotos; nova tentativa em 60 segundos.' >&2
      sleep 60
      continue
    fi
  else
    rm -f "$file.tmp"
    echo 'Falha no backup; nova tentativa em 60 segundos.' >&2
    sleep 60
    continue
  fi
  # Keep all backups; an operator exports/archives them before removing the volume.
  sleep 86400
done
