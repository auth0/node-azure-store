#!/bin/bash

# build src docs into a couchapp
default:
	cp config.sh.example config.sh
	chmod +x config.sh

# set environment variables for testing
config:
	./config.sh

# delete local and remote couchapp
clean:
	rm config.sh
	unset AZURE_SSO_SECRET

tests:
	mocha