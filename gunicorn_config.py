bind = "0.0.0.0:5000"
workers = 4
worker_class = "uvicorn.workers.UvicornWorker"
timeout = 300
accesslog = "/var/log/targethouse/access.log"
errorlog = "/var/log/targethouse/error.log"
loglevel = "info"
capture_output = True
enable_stdio_inheritance = True
worker_connections = 1000
keepalive = 5
max_requests = 1000
max_requests_jitter = 50
proc_name = "targethouse"
reload = False
preload_app = True
limit_request_line = 4096
limit_request_fields = 100
limit_request_field_size = 8190