bind = "0.0.0.0:5000"
workers = 4
worker_class = "uvicorn.workers.UvicornWorker"
timeout = 120
accesslog = "/var/log/targethouse/access.log"
errorlog = "/var/log/targethouse/error.log"
capture_output = True
enable_stdio_inheritance = True