FROM node:18-alpine

ARG VERSION=unknown
ENV VERSION=$VERSION

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 8080

CMD ["npm", "start"]
