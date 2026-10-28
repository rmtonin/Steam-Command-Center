FROM node:22-alpine
WORKDIR /app
COPY package.json server.js ./
COPY public ./public
ENV PORT=6767
ENV DATA_DIRECTORY=/data
EXPOSE 6767
CMD ["npm","start"]
