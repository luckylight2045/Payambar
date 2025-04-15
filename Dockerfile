# syntax=docker/dockerfile:1.4
FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json yarn.lock ./
COPY wait-for-mongo.sh ./

RUN chmod +x wait-for-mongo.sh

RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile --prefer-offline

COPY . .

CMD ["sh", "-c", "./wait-for-mongo.sh && yarn run start:dev"]