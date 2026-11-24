# Base R worker. Input: offset from X-window start, X, Y (tab-separated).
options(digits = 17, warn = 1)
args <- commandArgs(trailingOnly = TRUE)
days <- as.integer(args[1])
window <- as.integer(args[2])
d <- read.table(file("stdin"), col.names = c("day", "x", "y"),
                colClasses = "numeric", sep = "\t")
emit <- function(...) {
  cat(..., sep = "\t")
  cat("\n")
}
emit("version", as.character(getRversion()))
# Scaling avoids overflow in covariance and least squares for large inputs.
unit_scale <- function(x) if (max(abs(x)) > 0) max(abs(x)) else 1
sx <- unit_scale(d$x)
sy <- unit_scale(d$y)
d$u <- d$x / sx
d$v <- d$y / sy
coefficients <- function(u, v, x, y) {
  if (length(u) < 3 || length(unique(u)) < 2 || length(unique(v)) < 2) {
    return(c(NA_real_, NA_real_))
  }
  c(cor(u, v), cor(x, y, method = "spearman"))
}
corr <- coefficients(d$u, d$v, d$x, d$y)
emit("cor", corr[1], corr[2])
if (!is.na(corr[1])) {
  fit <- lm(v ~ u, data = d)
  emit("linear", coef(fit)[1] * sy, (coef(fit)[2] * sy) / sx)
}
for (key in c("x", "y")) {
  q <- quantile(d[[key]], c(0, .25, .5, .75, 1))
  emit("distribution", key, q[1], q[2], q[3], q[4], q[5])
}
if (nrow(d) >= 10 && length(unique(d$u)) >= 6 && length(unique(d$v)) >= 2) {
  smooth <- tryCatch({
    model <- loess(v ~ u, data = d, span = .75, degree = 1)
    grid <- seq(min(d$u), max(d$u), length.out = 40)
    data.frame(x = grid * sx, y = predict(model, newdata = data.frame(u = grid)) * sy)
  }, warning = function(w) NULL, error = function(e) NULL)
  if (!is.null(smooth) && all(is.finite(smooth$y))) {
    for (i in seq_len(nrow(smooth))) emit("loess", smooth$x[i], smooth$y[i])
  }
}
if (days >= window) {
  for (end in seq.int(window - 1, days - 1)) {
    sub <- d[d$day > end - window & d$day <= end, ]
    corr <- coefficients(sub$u, sub$v, sub$x, sub$y)
    emit("rolling", end, nrow(sub), corr[1], corr[2])
  }
}
