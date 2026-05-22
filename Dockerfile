FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    curl \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

RUN pip install uv

COPY package.json /app/package.json
RUN npm install

COPY . /app

RUN uv sync

ENV AGENT_NAME=NeuroAlpha
ENV INTERNAL_GATEWAY_PORT=9000

CMD ["node", "server.js"]
