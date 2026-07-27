#!/usr/bin/env sh
set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)

sudo chmod 0755 "$PROJECT_ROOT/scripts/backup-data.sh"
sudo install -m 0644 "$PROJECT_ROOT/deploy/lottery-tool-backup.service" /etc/systemd/system/lottery-tool-backup.service
sudo install -m 0644 "$PROJECT_ROOT/deploy/lottery-tool-backup.timer" /etc/systemd/system/lottery-tool-backup.timer
sudo systemctl daemon-reload
sudo systemctl enable --now lottery-tool-backup.timer
sudo systemctl start lottery-tool-backup.service
sudo systemctl status lottery-tool-backup.timer --no-pager
