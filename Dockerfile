# Use official Node.js image as base
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source files
COPY . .

# Build TypeScript
RUN npm run build

# Expose port (Render uses $PORT env variable)
EXPOSE 10000

# Start the app (Render sets PORT env variable)
CMD ["npm", "start"]
