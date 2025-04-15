#!/bin/sh

until mongosh --host mongo --eval "db.adminCommand('ping')"; do
  echo "Waiting for MongoDB..."
  sleep 2
done
echo "MongoDB ready!"
