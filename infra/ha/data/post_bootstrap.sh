#!/bin/sh
# Runs once, on the first primary only. Creates the app's role and database.
# psql variables quote the values, so any password is safe.
set -eu
psql "$1" -v ON_ERROR_STOP=1 -v u="$APP_DB_USER" -v p="$APP_DB_PASSWORD" -v d="$APP_DB_NAME" <<'SQL'
CREATE ROLE :"u" LOGIN PASSWORD :'p';
CREATE DATABASE :"d" OWNER :"u";
SQL
