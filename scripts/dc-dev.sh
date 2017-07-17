#!/bin/bash

set -e

docker-compose -f docker-compose.base.yml -f docker-compose.yml -f docker-compose.dev.yml -f example/redis/docker-compose.yml -f example/nginx/docker-compose.yml -f example/ldap/docker-compose.yml -f test/integration/docker-compose.yml $*
