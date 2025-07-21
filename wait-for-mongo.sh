#!/bin/sh
# wait-for-mongo.sh

until nc -z mongo 27017; do
  echo "Waiting for MongoDB port..."
  sleep 2
done

echo "MongoDB ready!"
