# frozen_string_literal: true

require "pg"
require "connection_pool"
require "uri"
require "thread"

module Records
  # This adapter never exposes a write connection to repositories or controllers.
  class Database
    class Unavailable < StandardError
      attr_reader :sql_state

      def initialize(sql_state: nil)
        @sql_state = sql_state
        super("Records are temporarily unavailable.")
      end
    end

    LIBPQ_OPTIONS = %w[sslmode sslcert sslkey sslrootcert sslcrl channel_binding application_name target_session_attrs].freeze
    PRISMA_OPTIONS = %w[schema connection_limit pool_timeout pgbouncer statement_cache_size socket_timeout].freeze
    DEFAULT_LOCK = Mutex.new

    def self.default
      DEFAULT_LOCK.synchronize { @default ||= new }
    end

    def self.connection_options(url)
      uri = URI.parse(url.to_s)
      raise Unavailable unless %w[postgres postgresql].include?(uri.scheme) && uri.host

      options = {
        host: uri.host, port: uri.port || 5432,
        dbname: URI::DEFAULT_PARSER.unescape(uri.path.to_s.delete_prefix("/")),
        user: URI::DEFAULT_PARSER.unescape(uri.user.to_s),
        password: URI::DEFAULT_PARSER.unescape(uri.password.to_s),
        connect_timeout: 5, application_name: "mavs-records-read"
      }
      URI.decode_www_form(uri.query.to_s).each do |key, value|
        next if PRISMA_OPTIONS.include?(key)
        options[key.to_sym] = value if LIBPQ_OPTIONS.include?(key)
      end
      options
    rescue URI::InvalidURIError, ArgumentError
      raise Unavailable, cause: nil
    end

    def initialize(url: ENV["DATABASE_URL"], pool: nil)
      options = self.class.connection_options(url) unless pool
      @pool = pool || ConnectionPool.new(size: 2, timeout: 5) do
        connection = PG.connect(options)
        connection.type_map_for_results = PG::BasicTypeMapForResults.new(connection)
        connection
      end
    end

    def read(sql, binds = [])
      @pool.with do |connection|
        connection.reset if connection.status != PG::CONNECTION_OK
        begin
          connection.exec("BEGIN READ ONLY")
          connection.exec("SET LOCAL statement_timeout = '5000ms'")
          result = connection.exec_params(sql, binds).to_a
          connection.exec("COMMIT")
          result
        rescue StandardError
          begin
            connection.exec("ROLLBACK") unless connection.finished?
          rescue PG::Error
            # The next checkout resets a disconnected connection.
          end
          raise
        end
      end
    rescue PG::Error => error
      code = error.result&.error_field(PG::Result::PG_DIAG_SQLSTATE)
      raise Unavailable.new(sql_state: code), cause: nil
    rescue ConnectionPool::TimeoutError
      raise Unavailable, cause: nil
    end
  end
end
