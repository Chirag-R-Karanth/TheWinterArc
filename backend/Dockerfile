FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o /winterarc ./cmd/server

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /winterarc /winterarc
EXPOSE 8080
ENTRYPOINT ["/winterarc"]