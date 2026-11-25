class MediaArchive
  SAFE_INLINE = %w[image/jpeg image/png image/gif image/webp image/avif image/x-icon video/mp4 video/webm audio/mpeg audio/ogg].freeze

  def self.entries
    root = ENV["MIGRATED_MEDIA_ROOT"]
    return {} unless root.present?
    Rails.cache.fetch(["media-manifest", root], expires_in: 60) do
      JSON.parse(File.read(File.join(root, "manifest.json"))).fetch("files").select { |row| row["public"] == true }.index_by { |row| row.fetch("key") }
    end
  rescue Errno::ENOENT, JSON::ParserError, KeyError
    {}
  end

  def self.file(key)
    row = entries[key]
    return unless row
    root = File.realpath(ENV.fetch("MIGRATED_MEDIA_ROOT"))
    path = File.realpath(File.join(root, row.fetch("path")))
    return unless path.start_with?(root + File::SEPARATOR) && File.file?(path)
    [path, row]
  rescue Errno::ENOENT, KeyError
    nil
  end

  def self.local_url(value)
    source = ENV["NEXT_PUBLIC_SUPABASE_URL"] || ENV["SUPABASE_URL"]
    return value unless source.present?
    uri = URI.parse(value.to_s)
    origin = URI.parse(source)
    prefix = "/storage/v1/object/public/"
    return value unless %w[http https].include?(uri.scheme) && [uri.scheme, uri.host, uri.port] == [origin.scheme, origin.host, origin.port] && !uri.userinfo && uri.path.start_with?(prefix)
    key = URI::DEFAULT_PARSER.unescape(uri.path.delete_prefix(prefix))
    return value unless entries.key?(key)
    "/media/#{key.split('/').map { |segment| ERB::Util.url_encode(segment) }.join('/')}"
  rescue URI::InvalidURIError
    value
  end
end
