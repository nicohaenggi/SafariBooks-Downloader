FROM node:latest
MAINTAINER harshavardhanc95@gmail.com
RUN mkdir /SafariBooks-Downloader
#copying the files inside the image
COPY . /SafariBooks-Downloader
WORKDIR /SafariBooks-Downloader
#installing node dependencies
RUN npm install -g
#verify the installation by running this inside container
#safaribooks-downloader --version
