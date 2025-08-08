FROM alpine:3.20
WORKDIR /app
ADD https://github.com/pocketbase/pocketbase/releases/download/v0.22.9/pocketbase_0.22.9_linux_amd64.zip pb.zip
RUN apk add --no-cache unzip && unzip pb.zip && rm pb.zip
VOLUME ["/app/pb_data"]
EXPOSE 8090
CMD ["/app/pocketbase","serve","--http","0.0.0.0:8090"]
