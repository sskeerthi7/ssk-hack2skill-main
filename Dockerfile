FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Native Cloud Build automated testing validation before finalizing deployment
RUN npm test

# Boot
EXPOSE 8080
CMD ["node", "server.js"]
