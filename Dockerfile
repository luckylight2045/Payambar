FROM node:20

WORKDIR /usr/src/app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .

EXPOSE 3000 

CMD [ "yarn", "run", "start:dev" ]