FROM node:20-alpine

WORKDIR /app

# Install system dependencies needed for baileys whatsapp build components
RUN apk add --no-cache python3 make g++ git

COPY package*.json ./

RUN npm install

COPY . .

# Run build step for Next.js app bundle compilation
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
