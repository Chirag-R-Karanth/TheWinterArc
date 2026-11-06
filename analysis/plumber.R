# WinterArc analysis service.
# rplumber R API called by the Go backend. It is deliberately treated as an
# optional, unreliable dependency by Go: this service may be down at any time
# and the dashboard must keep working.

library(plumber)
library(jsonlite)
library(RPostgres)
library(DBI)

set_defaults <- function() {
    options(warn = -1)
}

#* @apiTitle WinterArc Analysis
#* @apiDescription Correlation and stats computed over the unified metrics table.

#* Health check
#* @get /health
function(res) {
    res$status <- 200
    list(status = "ok", service = "winterarc-analysis", time = Sys.time())
}

connect <- function() {
    DBI::dbConnect(
        RPostgres::Postgres(),
        host = Sys.getenv("PGHOST", "localhost"),
        port = as.integer(Sys.getenv("PGPORT", "5432")),
        user = Sys.getenv("PGUSER", "winterarc"),
        password = Sys.getenv("PGPASSWORD", ""),
        dbname = Sys.getenv("PGDATABASE", "winterarc")
    )
}

# Aggregate one metric type to daily series (sum; averages for rate metrics).
# yMetric: when it is a value that should be averaged (e.g. mood, hrv), pass
# agg = "avg".
daily_series <- function(con, metric, from, to) {
    q <- sprintf("
      SELECT date_trunc('day', ts_start)::date AS day,
             SUM(value) AS v
      FROM metrics
      WHERE metric_type = $1 AND is_primary AND ts_start >= $2 AND ts_start <= $3
      GROUP BY day ORDER BY day
    ")
    DBI::dbGetQuery(con, q, params = list(metric, from, to))
}

#* Compute correlation between two metrics, bucketed by day.
#* @param body JSON body: {xMetric, yMetric, from, to}
#* @post /correlate
function(req, res) {
    body <- tryCatch(fromJSON(req$postBody, simplifyVector = TRUE),
                     error = function(e) NULL)
    if (is.null(body) || is.null(body$xMetric) || is.null(body$yMetric)) {
        res$status <- 400
        return(list(error = "xMetric and yMetric required"))
    }
    xm <- body$xMetric
    ym <- body$yMetric
    from <- if (!is.null(body$from)) body$from else as.character(Sys.Date() - 180)
    to   <- if (!is.null(body$to)) body$to else as.character(Sys.Date())

    con <- tryCatch(connect(), error = function(e) NULL)
    if (is.null(con)) {
        res$status <- 503
        return(list(error = "database unavailable"))
    }
    on.exit(tryCatch(DBI::dbDisconnect(con), error = function(e) NULL))

    xd <- daily_series(con, xm, from, to)
    yd <- daily_series(con, ym, from, to)
    if (nrow(xd) == 0 || nrow(yd) == 0) {
        return(list(n = 0, r = NA_real_, p = NA_real_,
                    slope = NA_real_, intercept = NA_real_, points = list()))
    }

    merged <- merge(xd, yd, by = "day", suffixes = c("_x", "_y"))
    merged <- merged[is.finite(merged$v_x) & is.finite(merged$v_y), ]
    if (nrow(merged) < 3) {
        return(list(n = nrow(merged), r = NA_real_, p = NA_real_,
                    slope = NA_real_, intercept = NA_real_, points = list()))
    }

    fit <- lm(v_y ~ v_x, data = merged)
    s <- summary(fit)
    r <- if (nrow(merged) > 2) cor(merged$v_x, merged$v_y) else NA_real_

    points <- lapply(seq_len(nrow(merged)), function(i) {
        list(date = as.character(as.Date(merged$day[i])),
             x = merged$v_x[i], y = merged$v_y[i])
    })

    list(
        n        = nrow(merged),
        r        = as.numeric(r),
        p        = if (!is.null(s$coefficients) && nrow(s$coefficients) > 1) s$coefficients[2, 4] else NA_real_,
        slope    = as.numeric(coef(fit)[2]),
        intercept = as.numeric(coef(fit)[1]),
        points   = points
    )
}

set_defaults()