#!/usr/bin/env bash
# exit on error
set -o errexit

npm install
npm rebuild sharp
rm -rf node_modules/sharp
npm install --arch=x64 --platform=linux --target=22.12.0 sharp 