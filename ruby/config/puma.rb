threads_count = Integer(ENV.fetch("RAILS_MAX_THREADS", "4"))
threads threads_count, threads_count
bind "tcp://#{ENV.fetch('BINDING', '127.0.0.1')}:#{ENV.fetch('PORT', '3002')}"
environment ENV.fetch("RAILS_ENV", "development")
pidfile ENV.fetch("PIDFILE", "tmp/pids/server.pid")
plugin :tmp_restart
