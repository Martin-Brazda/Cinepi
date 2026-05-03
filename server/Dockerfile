FROM ubuntu:22.04 AS builder

RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN curl -OL https://go.dev/dl/go1.23.6.linux-amd64.tar.gz \
    && tar -C /usr/local -xzf go1.23.6.linux-amd64.tar.gz \
    && rm go1.23.6.linux-amd64.tar.gz

ENV PATH="/usr/local/go/bin:${PATH}"

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN go build -o main .

RUN go run github.com/playwright-community/playwright-go/cmd/playwright@latest install chromium

FROM mcr.microsoft.com/playwright:v1.57.0-jammy


WORKDIR /root/

COPY --from=builder /app/main .

COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/.env ./.env

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

CMD ["./main"]