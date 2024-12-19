FROM public.ecr.aws/docker/library/node:21-slim
# set up working directory
WORKDIR /usr/src/app
# copy package.json for dependancies
COPY package*.json ./
# install dependancies
RUN npm install
# copy application files into container
COPY . .
# open port for web access
EXPOSE 3000
# start application
CMD [ "node", "src/app.js" ]
