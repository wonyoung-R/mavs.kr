# frozen_string_literal: true

require_relative "../test_helper"
require "minitest/mock"
require "tmpdir"
require "fileutils"
require "base64"
require "json"
require "nokogiri"

# Personas: a fan opening migrated article images and a visitor requesting files
# outside the public manifest. No real archive or database is used by this suite.
class MediaTest < ActionDispatch::IntegrationTest
  SOURCE = "https://fixture-project.supabase.co"
  PNG = Base64.decode64("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6b1sAAAAASUVORK5CYII=").freeze

  class FixtureContentRepository
    attr_accessor :content, :image_url

    def article(_kind, id)
      return unless id == "media-fixture"
      { "id" => id, "title" => "Synthetic article", "content" => content, "imageUrl" => image_url,
        "summary" => "Synthetic media fixture", "date" => Time.utc(2026, 1, 1), "updated" => Time.utc(2026, 1, 2), "author" => "Example writer" }
    end
  end

  setup do
    @saved_environment = %w[MIGRATED_MEDIA_ROOT NEXT_PUBLIC_SUPABASE_URL SUPABASE_URL].to_h { |key| [key, ENV[key]] }
    @directory = Dir.mktmpdir("mavs-media-qa-")
    @root = File.join(@directory, "archive")
    FileUtils.mkdir_p(@root, mode: 0o700)
    ENV["MIGRATED_MEDIA_ROOT"] = @root
    ENV["NEXT_PUBLIC_SUPABASE_URL"] = SOURCE
    ENV.delete("SUPABASE_URL")
    @rows = []
    add_file("Column/logo.png", "logo.png", "image/png", PNG)
    add_file("MAVS.KR/NBA_Logos/dal.png", "dal.png", "image/png", PNG)
    add_file("Column/vector.svg", "vector.svg", "image/svg+xml", '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
    add_file("Column/page.html", "page.html", "text/html; charset=utf-8", "<script>alert(1)</script><p>Fixture</p>")
    add_file("Column/unknown.bin", "unknown.bin", "", "SYNTHETIC BINARY")
    add_file("private/secret.png", "private.png", "image/png", PNG, public_file: false)
    add_file("Column/space + 한글.png", "unicode.png", "image/png", PNG)
    File.binwrite(File.join(@root, "not-listed.png"), PNG)
    write_manifest
  end

  teardown do
    @saved_environment.each { |key, value| value.nil? ? ENV.delete(key) : ENV[key] = value }
    FileUtils.remove_entry(@directory) if @directory && File.directory?(@directory)
  end

  test "known public PNG is returned inline with exact bytes and sandbox headers" do
    assert_equal 0o600, File.stat(File.join(@root, "manifest.json")).mode & 0o777
    get "/media/Column/logo.png"
    assert_response :success
    assert_equal PNG, response.body.b
    assert_equal "image/png", response.media_type
    assert_match(/\Ainline;/, response.headers.fetch("Content-Disposition"))
    assert_includes response.headers["Cache-Control"], "max-age=86400"
    assert_media_headers
  end

  test "unknown unlisted and private objects return 404 without leaking file data" do
    ["/media/Column/missing.png", "/media/Column/not-listed.png", "/media/private/secret.png"].each do |path|
      get path
      assert_missing_file
      refute_equal PNG, response.body.b
    end
  end

  test "dotted bucket names retain the full bucket and nested object path" do
    source = "#{SOURCE}/storage/v1/object/public/MAVS.KR/NBA_Logos/dal.png"
    assert_equal "/media/MAVS.KR/NBA_Logos/dal.png", MediaArchive.local_url(source)
    get MediaArchive.local_url(source)
    assert_response :success
    assert_equal PNG, response.body.b
    assert_equal "image/png", response.media_type
    assert_media_headers
  end

  test "known metadata with a missing local file returns 404" do
    @rows << { "key" => "Column/missing-on-disk.png", "path" => "missing-on-disk.png", "contentType" => "image/png", "public" => true }
    write_manifest
    get "/media/Column/missing-on-disk.png"
    assert_missing_file
  end

  test "SVG HTML and unknown types download as octet stream with no active content permissions" do
    %w[vector.svg page.html unknown.bin].each do |filename|
      get "/media/Column/#{filename}"
      assert_response :success
      assert_equal "application/octet-stream", response.media_type
      assert_match(/\Aattachment;/, response.headers.fetch("Content-Disposition"))
      assert_media_headers
    end
  end

  test "a public manifest entry cannot escape the archive through a relative path" do
    outside = File.join(@directory, "outside.png")
    File.binwrite(outside, "SYNTHETIC OUTSIDE FILE")
    @rows << { "key" => "Column/traversal.png", "path" => "../outside.png", "contentType" => "image/png", "public" => true }
    write_manifest
    get "/media/Column/traversal.png"
    assert_missing_file
    refute_includes response.body, "SYNTHETIC OUTSIDE FILE"
  end

  test "path traversal URL cannot reach an existing unlisted outside file" do
    File.binwrite(File.join(@directory, "outside.png"), "SYNTHETIC OUTSIDE FILE")
    ["/media/Column/%2e%2e/%2e%2e/outside.png", "/media/Column/..%2F..%2Foutside.png"].each do |path|
      get path
      assert_missing_file
      refute_includes response.body, "SYNTHETIC OUTSIDE FILE"
    end
  end

  test "symlink escape and a sibling sharing the root name both return 404" do
    sibling = File.join(@directory, "archive-other")
    FileUtils.mkdir_p(sibling, mode: 0o700)
    outside = File.join(sibling, "outside.png")
    File.binwrite(outside, "SYNTHETIC SIBLING FILE")
    File.symlink(outside, File.join(@root, "escape.png"))
    @rows << { "key" => "Column/escape.png", "path" => "escape.png", "contentType" => "image/png", "public" => true }
    @rows << { "key" => "Column/sibling.png", "path" => "../archive-other/outside.png", "contentType" => "image/png", "public" => true }
    write_manifest
    %w[escape sibling].each do |name|
      get "/media/Column/#{name}.png"
      assert_missing_file
      refute_includes response.body, "SYNTHETIC SIBLING FILE"
    end
  end

  test "missing or malformed manifests fail closed without exposing an on-disk file" do
    File.write(File.join(@root, "manifest.json"), "not-json")
    get "/media/Column/logo.png"
    assert_missing_file
    File.unlink(File.join(@root, "manifest.json"))
    get "/media/Column/logo.png"
    assert_missing_file
  end

  test "known public source URLs become local and encoded names round trip" do
    assert_equal "/media/Column/logo.png", MediaArchive.local_url("#{SOURCE}/storage/v1/object/public/Column/logo.png")
    encoded_name = ERB::Util.url_encode("space + 한글.png")
    value = "#{SOURCE}/storage/v1/object/public/Column/#{encoded_name}?download=1"
    assert_equal "/media/Column/#{encoded_name}", MediaArchive.local_url(value)
    get MediaArchive.local_url(value)
    assert_response :success
    assert_equal PNG, response.body.b
  end

  test "unrelated unknown and private URLs are not rewritten as public local files" do
    urls = [
      "https://other.supabase.co/storage/v1/object/public/Column/logo.png",
      "https://fixture-project.supabase.co.evil.example/storage/v1/object/public/Column/logo.png",
      "https://fixture-project.supabase.co@evil.example/storage/v1/object/public/Column/logo.png",
      "https://synthetic-user@fixture-project.supabase.co/storage/v1/object/public/Column/logo.png",
      "#{SOURCE}/storage/v1/object/public/Column/not-listed.png",
      "#{SOURCE}/storage/v1/object/public/private/secret.png",
      "#{SOURCE}/storage/v1/object/sign/Column/logo.png?token=synthetic",
      "https://example.test/logo.png", "/already-local.png", "javascript:alert(1)"
    ]
    urls.each { |url| assert_equal url, MediaArchive.local_url(url) }
    assert_nil MediaArchive.local_url(nil)
  end

  test "source URL conversion honors the configured origin including protocol and port" do
    ["http://fixture-project.supabase.co", "https://fixture-project.supabase.co:8443"].each do |origin|
      url = "#{origin}/storage/v1/object/public/Column/logo.png"
      assert_equal url, MediaArchive.local_url(url)
    end
  end

  test "article rendering rewrites known images and links after removing executable markup" do
    known = "#{SOURCE}/storage/v1/object/public/Column/logo.png"
    unknown = "https://example.test/unrelated.png"
    content = FixtureContentRepository.new
    content.image_url = known
    content.content = <<~HTML
      <p>Safe text</p><script id="body-script">alert(1)</script>
      <img src="#{known}" onerror="alert(2)" alt="known image">
      <img src="#{unknown}" alt="other image">
      <a href="#{known}" onclick="alert(3)">Known download</a>
      <a href="javascript:alert(4)">Unsafe link</a>
      <iframe srcdoc="<script>alert(5)</script>"></iframe>
    HTML
    ContentRepository.stub(:new, content) do
      get "/news/media-fixture"
      assert_response :success
      assert_select ".articleBody script, .articleBody iframe, .articleBody [onerror], .articleBody [onclick]", count: 0
      assert_select ".articleBody img[src=?]", "/media/Column/logo.png", count: 1
      assert_select ".articleBody img[src=?]", unknown, count: 1
      assert_select ".articleBody a[href=?]", "/media/Column/logo.png", count: 1
      refute Nokogiri::HTML(response.body).css(".articleBody [href]").any? { |node| node["href"].start_with?("javascript:") }
      assert_select "img.articleImage[src=?]", "/media/Column/logo.png"
      structured_data = JSON.parse(Nokogiri::HTML(response.body).at_css('script[type="application/ld+json"]').text)
      assert_equal "#{Rails.application.config.x.site_url}/media/Column/logo.png", structured_data["image"]
    end
  end

  private

  def add_file(key, path, content_type, data, public_file: true)
    File.binwrite(File.join(@root, path), data)
    File.chmod(0o600, File.join(@root, path))
    @rows << { "key" => key, "path" => path, "contentType" => content_type, "public" => public_file }
  end

  def write_manifest
    path = File.join(@root, "manifest.json")
    File.write(path, JSON.generate("files" => @rows))
    File.chmod(0o600, path)
  end

  def assert_media_headers
    assert_equal "nosniff", response.headers["X-Content-Type-Options"]
    assert_equal "sandbox; default-src 'none'", response.headers["Content-Security-Policy"]
  end

  def assert_missing_file
    assert_response :not_found
    assert_equal "no-store", response.headers["Cache-Control"]
    assert_equal "noindex", response.headers["X-Robots-Tag"]
  end
end
