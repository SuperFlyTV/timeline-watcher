#!/bin/sh

# This will be replaced with a gulpfile.
# Creates a javascript bundle and places it in the /dev directory for testing during development.

yarn build &&
browserify dist/index.js -o dev/bundle.js