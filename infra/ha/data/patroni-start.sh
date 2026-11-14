#!/bin/sh
# Fills in the one value Patroni cannot read from the environment, then starts it.
set -eu
: "${PRIVATE_CIDR:?set PRIVATE_CIDR (the private link, e.g. 10.20.0.0/24)}"
sed "s|__PRIVATE_CIDR__|${PRIVATE_CIDR}|g" /etc/patroni/patroni.yml.tpl > /tmp/patroni.yml
exec patroni /tmp/patroni.yml
