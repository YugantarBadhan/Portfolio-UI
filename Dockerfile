### STAGE 1: Build ###
FROM node:14.20.1 AS build
WORKDIR /app
COPY . .
COPY .npmrc .npmrc
COPY package.json package.json
RUN npm cache clean --force
RUN npm install -g @angular/cli@15.2.9
RUN npm install
RUN ng build               

### STAGE 2: Run ###
FROM nginx:1.17.1-alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist/ /usr/share/nginx/html
CMD ["nginx", "-g", "daemon off;"]