# Build context: ruby/ (for example, docker build -t mavs-ruby ./ruby).
# No database access, application migration, or secret is needed at build time.
ARG RUBY_VERSION=3.4
FROM ruby:${RUBY_VERSION}-slim-bookworm AS base

WORKDIR /app

ENV RAILS_ENV=production \
    BUNDLE_DEPLOYMENT=1 \
    BUNDLE_WITHOUT=test \
    BUNDLE_PATH=/usr/local/bundle \
    PORT=3002 \
    BINDING=0.0.0.0

RUN apt-get update -qq \
    && apt-get install --no-install-recommends -y ca-certificates libpq5 libxml2 libxslt1.1 \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build

# Gemfile requires source builds of pg and Nokogiri. Use Debian's XML libraries
# consistently at build time and runtime; no Node or asset compiler is required.
ENV BUNDLE_BUILD__NOKOGIRI="--use-system-libraries"

RUN apt-get update -qq \
    && apt-get install --no-install-recommends -y \
       build-essential pkg-config libpq-dev libxml2-dev libxslt1-dev \
       zlib1g-dev liblzma-dev libssl-dev libyaml-dev \
    && rm -rf /var/lib/apt/lists/*

COPY Gemfile Gemfile.lock ./
RUN gem install bundler -v 2.6.9 --no-document \
    && bundle install --jobs 4 --retry 3 \
    && bundle exec ruby -e 'require "pg"; require "nokogiri"; require "puma"'

FROM base AS runtime

RUN groupadd --gid 10001 rails \
    && useradd --uid 10001 --gid 10001 --create-home --shell /usr/sbin/nologin rails

COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --chown=10001:10001 . .

RUN mkdir -p tmp/pids tmp/cache log \
    && chown -R 10001:10001 tmp log

USER 10001:10001
EXPOSE 3002

# Supply DATABASE_URL and SECRET_KEY_BASE at runtime. HTTPS termination and Host
# routing must match SITE_URL. The application never runs db:prepare on startup.
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
