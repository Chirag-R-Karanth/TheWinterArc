FROM rocker/r-ver:4.4

# R packages below need these system headers to build from source
# (httpuv/libuv, webutils/libsodium, RPostgres/libpq, curl/libcurl).
RUN apt-get update && apt-get install -y --no-install-recommends \
        libcurl4-openssl-dev \
        libsodium-dev \
        libuv1-dev \
        libpq-dev \
        zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# install.packages() silently tolerates failures, so verify every package is
# installed+loadable afterwards and hard-fail the build otherwise.
RUN Rscript -e 'libs <- c("plumber", "jsonlite", "RPostgres", "DBI", "lubridate"); \
    install.packages(libs, repos = "https://cloud.r-project.org", quiet = TRUE); \
    missing <- libs[!sapply(libs, requireNamespace, quietly = TRUE)]; \
    if (length(missing)) stop("failed to install: ", paste(missing, collapse = ", "))'

WORKDIR /app
COPY plumber.R start.R .

EXPOSE 8002
CMD ["Rscript", "start.R"]